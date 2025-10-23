const STATUSES = [
  { id: '1', slug: 'watching', label: 'Watching' },
  { id: '2', slug: 'completed', label: 'Completed' },
  { id: '3', slug: 'onHold', label: 'On Hold' },
  { id: '4', slug: 'dropped', label: 'Dropped' },
  { id: '6', slug: 'wantToWatch', label: 'Want to Watch' }
];

const state = {
  profile: null,
  filterText: '',
  activeStatuses: new Set(STATUSES.map((status) => status.slug)),
  loading: false
};

const elements = {
  avatar: document.getElementById('avatar'),
  bio: document.getElementById('bio'),
  hero: document.getElementById('hero'),
  statusChip: document.getElementById('statusChip'),
  statsGrid: document.getElementById('statsGrid'),
  lists: document.getElementById('lists'),
  searchInput: document.getElementById('searchInput'),
  statusBadges: document.getElementById('statusBadges'),
  toast: document.getElementById('toast'),
  usernameInput: document.getElementById('usernameInput'),
  refreshButton: document.getElementById('refreshButton'),
  sampleButton: document.getElementById('sampleButton')
};

document.addEventListener('DOMContentLoaded', () => {
  elements.refreshButton.addEventListener('click', () => {
    const username = elements.usernameInput.value.trim();
    if (!username) {
      showToast('Please enter an Anime-Planet username.');
      return;
    }
    loadProfile(username, { forceRemote: true });
  });

  elements.sampleButton.addEventListener('click', async () => {
    const sample = await fetchSample();
    if (sample) {
      updateProfile(sample, { source: 'sample' });
      showToast('Showing offline sample data. Remote fetch skipped.');
    }
  });

  elements.searchInput.addEventListener('input', (event) => {
    state.filterText = event.target.value.toLowerCase();
    renderLists();
  });

  renderStatusBadges();
  loadProfile(elements.usernameInput.value.trim());
});

async function fetchSample() {
  try {
    const response = await fetch('/sample-profile.json');
    if (!response.ok) throw new Error('Sample unavailable');
    return response.json();
  } catch (error) {
    showToast('Unable to load sample data.');
    console.error(error);
    return null;
  }
}

function renderStatusBadges() {
  elements.statusBadges.innerHTML = '';
  STATUSES.forEach((status) => {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'badge is-active';
    badge.dataset.slug = status.slug;
    badge.textContent = status.label;
    badge.addEventListener('click', () => toggleStatusFilter(status.slug, badge));
    elements.statusBadges.appendChild(badge);
  });
}

function toggleStatusFilter(slug, badge) {
  if (state.activeStatuses.has(slug) && state.activeStatuses.size === 1) {
    showToast('At least one list must stay visible.');
    return;
  }

  if (state.activeStatuses.has(slug)) {
    state.activeStatuses.delete(slug);
    badge.classList.remove('is-active');
  } else {
    state.activeStatuses.add(slug);
    badge.classList.add('is-active');
  }

  renderLists();
}

async function loadProfile(username, { forceRemote = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  setLoading(true);

  try {
    const baseData = await fetchProxy({ username, cacheBust: Date.now(), forceRemote });

    if (baseData.source === 'sample') {
      updateProfile(baseData.body, baseData);
      showToast('Remote fetch unavailable. Displaying the cozy sample data.');
      return;
    }

    const html = baseData.body;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const profile = {
      username,
      avatar:
        findAttr(doc, ['.userAvatar img', '.profileAvatar img', '.avatar img', 'img.avatar']) ||
        'https://cdn.anime-planet.com/images/characters/thumbs/15744.jpg?t=1606765211',
      banner: findAttr(doc, ['.profileBanner img', '.userBanner img'], 'src'),
      bio:
        findText(doc, [
          '.profileAbout',
          '.userProfile__bio',
          '.profileDetails .paragraph',
          '.profile-details__bio'
        ]) || 'Welcome to this sparkling anime garden!',
      stats: extractStats(doc),
      statuses: []
    };

    for (const status of STATUSES) {
      const pageData = await fetchProxy({ username, status: status.id, page: 1, cacheBust: Date.now(), forceRemote });

      if (pageData.source === 'sample' && pageData.body) {
        updateProfile(pageData.body, pageData);
        showToast('Using sample data for this session.');
        return;
      }

      const listDoc = new DOMParser().parseFromString(pageData.body, 'text/html');
      const items = extractAnimeCards(listDoc);
      profile.statuses.push({ slug: status.slug, label: status.label, items });
    }

    profile.lastUpdated = new Date().toLocaleString();
    updateProfile(profile, baseData);
  } catch (error) {
    console.error('Failed to load profile:', error);
    const sample = await fetchSample();
    if (sample) {
      updateProfile(sample, { source: 'sample' });
      showToast('Falling back to sample data because the real site was shy.');
    } else {
      showToast('We could not fetch your anime list right now.');
    }
  } finally {
    state.loading = false;
    setLoading(false);
  }
}

async function fetchProxy(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.append(key, value);
  });

  const response = await fetch(`/api/profile?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Proxy request failed with ${response.status}`);
  }

  return response.json();
}

function extractStats(doc) {
  const stats = {
    watching: null,
    completed: null,
    onHold: null,
    dropped: null,
    wantToWatch: null,
    totalEntries: null,
    episodesWatched: null
  };

  const statLabels = [
    ['watching', /watching/i],
    ['completed', /completed/i],
    ['onHold', /on\s*hold/i],
    ['dropped', /dropped/i],
    ['wantToWatch', /(want|plan)\s*to\s*watch/i],
    ['episodesWatched', /(episodes\s*watched|ep\.?\s*watched)/i]
  ];

  const statElements = Array.from(
    doc.querySelectorAll('[class*="stat"], .profileStats li, .userProfile__stat, .profile-stats__item')
  );

  statElements.forEach((element) => {
    const text = element.textContent.trim();
    const valueMatch = text.replace(/[^0-9]+/g, ' ').trim().split(' ').find(Boolean);
    const value = valueMatch ? Number(valueMatch.replace(/,/g, '')) : null;

    for (const [key, regex] of statLabels) {
      if (regex.test(text) && value !== null && !Number.isNaN(value)) {
        stats[key] = value;
        break;
      }
    }
  });

  const total = Object.values(stats)
    .filter((value) => typeof value === 'number' && !Number.isNaN(value))
    .reduce((sum, value) => sum + value, 0);

  if (!stats.totalEntries && total > 0) {
    stats.totalEntries = total;
  }

  return stats;
}

function extractAnimeCards(doc) {
  const cards = [];
  const candidates = doc.querySelectorAll(
    [
      '.card',
      '.entry',
      'li[class*="card"]',
      'li[class*="entry"]',
      'article[class*="card"]',
      '.listItem'
    ].join(', ')
  );

  candidates.forEach((element) => {
    const titleElement = element.querySelector('.cardName, .name, .title, a[href*="/anime/"]');
    const linkElement = element.querySelector('a[href*="/anime/"]');
    const imageElement = element.querySelector('img');

    if (!titleElement || !linkElement) {
      return;
    }

    const title = titleElement.textContent.trim();
    const url = new URL(linkElement.getAttribute('href'), 'https://www.anime-planet.com').toString();
    const imageSrc =
      imageElement?.getAttribute('data-src') || imageElement?.getAttribute('data-image') || imageElement?.getAttribute('src');

    const typeText = findTextWithin(element, [
      '.type',
      '.format',
      '.cardType',
      '.meta',
      '.details',
      '.entryType'
    ]);

    const progressText = findTextWithin(element, ['.progress', '.status', '.watchProgress', '.cardStatus']);
    const ratingText = findTextWithin(element, ['.userRating', '.rating', '.stars', '.myScore']);
    const notesText = findTextWithin(element, ['.notes', '.comment', '.listNotes']);

    cards.push({
      title,
      url,
      image: normalizeImage(imageSrc),
      type: typeText || 'Anime',
      progress: progressText || 'Progress unknown',
      rating: ratingText || '',
      notes: notesText || ''
    });
  });

  return cards;
}

function findAttr(doc, selectors, attr = 'src') {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element && element.getAttribute(attr)) {
      const value = element.getAttribute(attr);
      if (value?.startsWith('//')) {
        return `https:${value}`;
      }
      return value;
    }
  }
  return null;
}

function findText(doc, selectors) {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text) return text;
    }
  }
  return null;
}

function findTextWithin(root, selectors) {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text) return text;
    }
  }
  return '';
}

function normalizeImage(src) {
  if (!src) return 'https://cdn.anime-planet.com/images/characters/thumbs/21249.jpg?t=1578669141';
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `https://www.anime-planet.com${src}`;
  return src;
}

function updateProfile(profile, meta = {}) {
  state.profile = profile;
  renderHero(profile, meta);
  renderStats(profile.stats);
  renderLists();
}

function renderHero(profile, meta) {
  elements.avatar.src = profile.avatar || 'https://cdn.anime-planet.com/images/characters/thumbs/21249.jpg?t=1578669141';
  elements.avatar.alt = `${profile.username}'s avatar`;
  elements.bio.textContent = profile.bio || 'This profile is keeping their secrets for now.';
  elements.statusChip.textContent = meta.source === 'sample' ? 'Sample Mode' : 'Live Data';

  if (profile.banner) {
    elements.hero.style.setProperty('--hero-banner', `url(${profile.banner})`);
    elements.hero.style.backgroundImage = `linear-gradient(135deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.55)), url(${profile.banner})`;
    elements.hero.style.backgroundSize = 'cover';
    elements.hero.style.backgroundPosition = 'center';
  } else {
    elements.hero.style.backgroundImage = 'none';
  }
}

function renderStats(stats = {}) {
  elements.statsGrid.innerHTML = '';

  const statEntries = [
    { label: 'Watching', key: 'watching' },
    { label: 'Completed', key: 'completed' },
    { label: 'On Hold', key: 'onHold' },
    { label: 'Dropped', key: 'dropped' },
    { label: 'Plan to Watch', key: 'wantToWatch' },
    { label: 'Episodes Watched', key: 'episodesWatched' },
    { label: 'Total Entries', key: 'totalEntries' }
  ];

  statEntries.forEach(({ label, key }) => {
    if (stats[key] === null || stats[key] === undefined) return;
    const card = document.createElement('article');
    card.className = 'stat-card';

    const labelEl = document.createElement('span');
    labelEl.className = 'stat-card__label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'stat-card__value';
    valueEl.textContent = stats[key].toLocaleString();

    card.append(labelEl, valueEl);
    elements.statsGrid.appendChild(card);
  });
}

function renderLists() {
  if (!state.profile) return;

  elements.lists.innerHTML = '';
  const template = document.getElementById('statusTemplate');
  const cardTemplate = document.getElementById('cardTemplate');

  state.profile.statuses
    .filter((status) => state.activeStatuses.has(status.slug))
    .forEach((status) => {
      const statusNode = template.content.firstElementChild.cloneNode(true);
      const title = statusNode.querySelector('.list__title');
      const count = statusNode.querySelector('.list__count');
      const grid = statusNode.querySelector('.list__grid');

      const filteredItems = status.items.filter((item) => {
        if (!state.filterText) return true;
        const haystack = [item.title, item.notes, item.progress, item.type, item.rating]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(state.filterText);
      });

      title.textContent = status.label;
      count.textContent = `${filteredItems.length} title${filteredItems.length === 1 ? '' : 's'}`;

      if (filteredItems.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No titles sparkle here yet!';
        empty.style.margin = '0';
        empty.style.color = 'var(--text-soft)';
        grid.appendChild(empty);
      } else {
        filteredItems.forEach((item) => {
          const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);
          const img = cardNode.querySelector('img');
          const type = cardNode.querySelector('.card__type');
          const titleEl = cardNode.querySelector('.card__title');
          const progress = cardNode.querySelector('.card__progress');
          const notes = cardNode.querySelector('.card__notes');
          const rating = cardNode.querySelector('.card__rating');
          const link = cardNode.querySelector('.card__link');

          img.src = item.image || 'https://cdn.anime-planet.com/images/characters/thumbs/15744.jpg?t=1606765211';
          img.alt = `${item.title} cover art`;
          type.textContent = item.type || 'Anime';
          titleEl.textContent = item.title;
          progress.textContent = item.progress || '';
          notes.textContent = item.notes || '';
          rating.textContent = item.rating || '';
          link.href = item.url;

          grid.appendChild(cardNode);
        });
      }

      elements.lists.appendChild(statusNode);
    });
}

let toastTimeout;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 4000);
}

function setLoading(isLoading) {
  if (isLoading) {
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = 'Fetching ✨';
  } else {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = 'Fetch ✨';
  }
}
