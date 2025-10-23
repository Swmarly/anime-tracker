const DEFAULT_AVATAR = 'https://cdn.anime-planet.com/images/characters/thumbs/21249.jpg?t=1578669141';

const state = {
  profile: null,
  filterText: '',
  statuses: [],
  activeStatuses: new Set()
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
  title: document.getElementById('title'),
  lastUpdated: document.getElementById('lastUpdated')
};

document.addEventListener('DOMContentLoaded', async () => {
  elements.searchInput?.addEventListener('input', (event) => {
    state.filterText = event.target.value.toLowerCase();
    renderLists();
  });

  try {
    const profile = await fetchProfile();
    initializeProfile(profile);
    showToast('Loaded profile snapshot.');
  } catch (error) {
    console.error('Failed to load profile snapshot:', error);
    showToast('Unable to load profile snapshot.');
    renderErrorState();
  }
});

async function fetchProfile() {
  const response = await fetch('profile.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Profile request failed with ${response.status}`);
  }
  return response.json();
}

function initializeProfile(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  state.profile = profile;
  state.statuses = profile.statuses;
  state.activeStatuses = new Set(state.statuses.map((status) => status.slug));

  renderStatusBadges();
  renderHero(profile);
  renderStats(profile.stats);
  renderLists();
}

function normalizeProfile(raw = {}) {
  const normalizedStatuses = Array.isArray(raw.statuses)
    ? raw.statuses.map(normalizeStatus)
    : [];

  return {
    username: raw.username || 'Anime Fan',
    avatar: raw.avatar || DEFAULT_AVATAR,
    banner: raw.banner || null,
    bio: raw.bio || 'This profile is keeping their secrets for now.',
    stats: raw.stats || {},
    statuses: normalizedStatuses,
    lastUpdated: raw.lastUpdated || ''
  };
}

function normalizeStatus(status, index) {
  const rawSlug = status?.slug || slugify(status?.label || `list-${index + 1}`);
  const label = status?.label || titleCase(rawSlug);
  const items = Array.isArray(status?.items) ? status.items.map(normalizeItem) : [];

  return { slug: rawSlug, label, items };
}

function normalizeItem(item = {}) {
  return {
    title: item.title || 'Untitled entry',
    url: item.url || '#',
    image: normalizeImage(item.image),
    type: item.type || '',
    progress: item.progress || '',
    rating: item.rating || '',
    notes: item.notes || ''
  };
}

function renderHero(profile) {
  if (elements.title) {
    elements.title.textContent = `${profile.username}'s Anime Garden`;
  }

  if (elements.avatar) {
    elements.avatar.src = profile.avatar || DEFAULT_AVATAR;
    elements.avatar.alt = `${profile.username}'s avatar`;
  }

  if (elements.bio) {
    elements.bio.textContent = profile.bio;
  }

  if (elements.statusChip) {
    elements.statusChip.textContent = 'Static Snapshot';
  }

  if (elements.lastUpdated) {
    elements.lastUpdated.textContent = profile.lastUpdated
      ? `Last updated ${profile.lastUpdated}`
      : '';
    elements.lastUpdated.hidden = !profile.lastUpdated;
  }

  if (profile.banner && elements.hero) {
    elements.hero.style.setProperty('--hero-banner', `url(${profile.banner})`);
    elements.hero.style.backgroundImage = `linear-gradient(135deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.55)), url(${profile.banner})`;
    elements.hero.style.backgroundSize = 'cover';
    elements.hero.style.backgroundPosition = 'center';
  } else if (elements.hero) {
    elements.hero.style.backgroundImage = 'none';
  }
}

function renderStats(stats = {}) {
  if (!elements.statsGrid) return;
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

  const availableStats = statEntries.filter(({ key }) =>
    typeof stats[key] === 'number' && !Number.isNaN(stats[key])
  );

  if (availableStats.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'stats__empty';
    empty.textContent = 'No stats available in this snapshot yet.';
    elements.statsGrid.appendChild(empty);
    return;
  }

  availableStats.forEach(({ label, key }) => {
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

function renderStatusBadges() {
  if (!elements.statusBadges) return;
  elements.statusBadges.innerHTML = '';

  if (state.statuses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'badge-row__empty';
    empty.textContent = 'No lists to filter yet.';
    elements.statusBadges.appendChild(empty);
    return;
  }

  state.statuses.forEach((status) => {
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

function renderLists() {
  if (!elements.lists) return;
  elements.lists.innerHTML = '';

  if (!state.profile || state.statuses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'lists__empty';
    empty.textContent = 'No anime lists found in this snapshot yet.';
    elements.lists.appendChild(empty);
    return;
  }

  const template = document.getElementById('statusTemplate');
  const cardTemplate = document.getElementById('cardTemplate');

  state.statuses
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

          img.src = item.image || DEFAULT_AVATAR;
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

function renderErrorState() {
  if (!elements.lists) return;
  elements.lists.innerHTML = '';
  const message = document.createElement('p');
  message.className = 'lists__empty';
  message.textContent = 'We could not load the profile data right now. Please ensure profile.json is present.';
  elements.lists.appendChild(message);
}

let toastTimeout;
function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 4000);
}

function normalizeImage(src) {
  if (!src) return DEFAULT_AVATAR;
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `https://www.anime-planet.com${src}`;
  return src;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}
