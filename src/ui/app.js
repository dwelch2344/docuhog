// DocuHog - Web UI Application Logic

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    envelopes: [],
    selectedId: null,
    expandedId: null,
    activeTab: 'envelopes',  // 'envelopes' | 'templates'
    searchQuery: '',
    statusFilter: null,
    connected: true,
    refreshTimer: null,
    selectedIndex: -1,
    jsonVisible: {},
  };

  const API_BASE = '/api/v1';
  const REFRESH_INTERVAL = 5000;

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------
  async function apiFetch(path, opts) {
    try {
      const res = await fetch(API_BASE + path, opts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setConnected(true);
      if (res.status === 204) return null;
      return res.json();
    } catch (err) {
      setConnected(false);
      throw err;
    }
  }

  async function loadEnvelopes() {
    try {
      const data = await apiFetch('/envelopes');
      // API might return { envelopes: [...] } or an array directly
      state.envelopes = Array.isArray(data) ? data : (data && data.envelopes ? data.envelopes : []);
      // Sort newest first
      state.envelopes.sort(function (a, b) {
        return new Date(b.createdDateTime || b.created || 0) - new Date(a.createdDateTime || a.created || 0);
      });
      render();
    } catch (_) {
      // connection lost; render keeps old data
      render();
    }
  }

  async function loadEnvelopeDetail(id) {
    try {
      return await apiFetch('/envelopes/' + id);
    } catch (_) {
      return null;
    }
  }

  async function deleteEnvelope(id) {
    await apiFetch('/envelopes/' + id, { method: 'DELETE' });
    if (state.expandedId === id) state.expandedId = null;
    if (state.selectedId === id) state.selectedId = null;
    await loadEnvelopes();
    toast('Envelope deleted');
  }

  async function deleteAllEnvelopes() {
    await apiFetch('/envelopes', { method: 'DELETE' });
    state.expandedId = null;
    state.selectedId = null;
    state.selectedIndex = -1;
    await loadEnvelopes();
    toast('All envelopes deleted');
  }

  // ---------------------------------------------------------------------------
  // Connection indicator
  // ---------------------------------------------------------------------------
  function setConnected(val) {
    if (state.connected === val) return;
    state.connected = val;
    var dot = document.getElementById('connection-dot');
    var label = document.getElementById('connection-label');
    if (dot) dot.className = 'connection-dot' + (val ? '' : ' disconnected');
    if (label) label.textContent = val ? 'Connected' : 'Disconnected';
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  function toast(msg, isError) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Confirm dialog
  // ---------------------------------------------------------------------------
  function confirm(title, message) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML =
        '<div class="confirm-dialog">' +
          '<h3>' + esc(title) + '</h3>' +
          '<p>' + esc(message) + '</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn-cancel">Cancel</button>' +
            '<button class="btn-confirm-danger">Delete</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.btn-cancel').onclick = function () { overlay.remove(); resolve(false); };
      overlay.querySelector('.btn-confirm-danger').onclick = function () { overlay.remove(); resolve(true); };
      overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }

  function formatTimestamp(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString();
  }

  function getStatus(env) {
    return (env.status || 'created').toLowerCase();
  }

  function getSubject(env) {
    return env.emailSubject || env.subject || '(No subject)';
  }

  function getSender(env) {
    if (env.sender) return env.sender.userName || env.sender.name || env.sender.email || '';
    return env.senderName || env.senderEmail || '';
  }

  function getRecipients(env) {
    var recips = [];
    var containers = env.recipients || {};
    var keys = ['signers', 'carbonCopies', 'certifiedDeliveries', 'inPersonSigners', 'agents', 'editors', 'intermediaries', 'witnesses'];
    keys.forEach(function (key) {
      if (Array.isArray(containers[key])) {
        containers[key].forEach(function (r) { recips.push(r); });
      }
    });
    // Fallback: if recipients is an array
    if (Array.isArray(env.recipients)) {
      recips = env.recipients;
    }
    return recips;
  }

  function getDocuments(env) {
    if (Array.isArray(env.documents)) return env.documents;
    if (env.envelopeDocuments && Array.isArray(env.envelopeDocuments)) return env.envelopeDocuments;
    return [];
  }

  function getCreatedDate(env) {
    return env.createdDateTime || env.created || env.statusChangedDateTime || '';
  }

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  function filteredEnvelopes() {
    var list = state.envelopes;
    if (state.statusFilter) {
      list = list.filter(function (e) { return getStatus(e) === state.statusFilter; });
    }
    if (state.searchQuery) {
      var q = state.searchQuery.toLowerCase();
      list = list.filter(function (e) {
        if (getSubject(e).toLowerCase().indexOf(q) !== -1) return true;
        if (getSender(e).toLowerCase().indexOf(q) !== -1) return true;
        if ((e.envelopeId || e.id || '').toLowerCase().indexOf(q) !== -1) return true;
        var recips = getRecipients(e);
        for (var i = 0; i < recips.length; i++) {
          var r = recips[i];
          if ((r.name || '').toLowerCase().indexOf(q) !== -1) return true;
          if ((r.email || '').toLowerCase().indexOf(q) !== -1) return true;
        }
        return false;
      });
    }
    return list;
  }

  function statusCounts() {
    var counts = {};
    state.envelopes.forEach(function (e) {
      var s = getStatus(e);
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }

  // ---------------------------------------------------------------------------
  // JSON syntax highlighting
  // ---------------------------------------------------------------------------
  function highlightJson(obj) {
    var json = JSON.stringify(obj, null, 2);
    return json.replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="json-key">$1</span>:')
               .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="json-string">$1</span>')
               .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
               .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
               .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
  }

  // ---------------------------------------------------------------------------
  // SVG icons
  // ---------------------------------------------------------------------------
  var ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    doc: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    emptyPig: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="52" rx="30" ry="25"/><circle cx="38" cy="45" r="2" fill="currentColor"/><circle cx="56" cy="45" r="2" fill="currentColor"/><ellipse cx="47" cy="54" rx="8" ry="5" stroke-width="2"/><circle cx="44" cy="54" r="1.5" fill="currentColor"/><circle cx="50" cy="54" r="1.5" fill="currentColor"/><path d="M20 48 Q12 40 18 32"/><path d="M80 48 Q88 40 82 32"/><path d="M35 76 L33 88"/><path d="M65 76 L67 88"/><path d="M75 60 Q86 58 85 52" stroke-width="2"/></svg>',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function render() {
    var app = document.getElementById('app-content');
    if (!app) return;

    if (state.activeTab === 'templates') {
      app.innerHTML = renderTemplatesTab();
      return;
    }

    var filtered = filteredEnvelopes();
    var counts = statusCounts();
    var html = '';

    // Stats bar
    html += renderStatsBar(counts);

    // Toolbar
    html += renderToolbar();

    // Envelope list or empty state
    if (state.envelopes.length === 0) {
      html += renderEmptyState();
    } else if (filtered.length === 0) {
      html += '<div class="empty-state">' +
        '<h3>No matching envelopes</h3>' +
        '<p>Try adjusting your search or filters.</p>' +
        '</div>';
    } else {
      html += '<ul class="envelope-list">';
      filtered.forEach(function (env, idx) {
        var id = env.envelopeId || env.id;
        html += renderEnvelopeItem(env, idx);
        if (state.expandedId === id) {
          html += '<li class="detail-panel" id="detail-' + esc(id) + '">' + renderDetail(env) + '</li>';
        }
      });
      html += '</ul>';
    }

    // Keyboard hints
    html += '<div class="kbd-hint">' +
      '<span><kbd>j</kbd> / <kbd>k</kbd> navigate</span>' +
      '<span><kbd>Enter</kbd> open</span>' +
      '<span><kbd>Esc</kbd> close</span>' +
      '<span><kbd>/</kbd> search</span>' +
      '</div>';

    app.innerHTML = html;
    bindListEvents();
  }

  function renderStatsBar(counts) {
    var total = state.envelopes.length;
    var html = '<div class="stats-bar">';
    html += '<span class="stat"><span class="stat-value">' + total + '</span> envelope' + (total !== 1 ? 's' : '') + '</span>';
    var statuses = ['created', 'sent', 'delivered', 'completed', 'voided', 'declined'];
    statuses.forEach(function (s) {
      if (counts[s]) {
        html += '<span class="stat-divider"></span>';
        html += '<span class="stat"><span class="status-badge status-' + s + '">' + s + '</span> <span class="stat-value">' + counts[s] + '</span></span>';
      }
    });
    html += '</div>';
    return html;
  }

  function renderToolbar() {
    var html = '<div class="toolbar">';
    // Search
    html += '<div class="search-box">';
    html += '<span class="search-icon">' + ICONS.search + '</span>';
    html += '<input type="text" id="search-input" placeholder="Search envelopes..." value="' + esc(state.searchQuery) + '" />';
    html += '</div>';
    // Status filters
    html += '<div class="filter-group">';
    var statuses = ['sent', 'delivered', 'completed', 'voided'];
    html += '<button class="filter-btn' + (!state.statusFilter ? ' active' : '') + '" data-status="">All</button>';
    statuses.forEach(function (s) {
      html += '<button class="filter-btn' + (state.statusFilter === s ? ' active' : '') + '" data-status="' + s + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>';
    });
    html += '</div>';
    // Actions
    html += '<div class="toolbar-actions">';
    html += '<button class="btn btn-danger" id="btn-delete-all">' + ICONS.trash + ' Delete All</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderEnvelopeItem(env, idx) {
    var id = env.envelopeId || env.id;
    var status = getStatus(env);
    var isSelected = state.selectedIndex === idx;
    var isExpanded = state.expandedId === id;
    var recips = getRecipients(env);
    var recipCount = recips.length;

    var cls = 'envelope-item' + (isSelected ? ' selected' : '');
    var html = '<li class="' + cls + '" data-id="' + esc(id) + '" data-idx="' + idx + '">';
    html += '<span class="status-badge status-' + esc(status) + '">' + esc(status) + '</span>';
    html += '<span class="envelope-subject">' + esc(getSubject(env)) + '</span>';
    html += '<span class="envelope-meta">';
    html += '<span class="envelope-sender">' + esc(getSender(env)) + '</span>';
    if (recipCount > 0) {
      html += '<span class="envelope-recipients-count">' + recipCount + ' recipient' + (recipCount !== 1 ? 's' : '') + '</span>';
    }
    html += '<span class="envelope-date">' + esc(formatDate(getCreatedDate(env))) + '</span>';
    html += '</span>';
    html += '</li>';
    return html;
  }

  function renderDetail(env) {
    var id = env.envelopeId || env.id;
    var status = getStatus(env);
    var recips = getRecipients(env);
    var docs = getDocuments(env);
    var isJsonOpen = state.jsonVisible[id];

    var html = '<div class="detail-header">';
    html += '<span class="detail-title">' + esc(getSubject(env)) + '</span>';
    html += '<div class="detail-actions">';
    html += '<button class="btn btn-danger btn-delete-one" data-id="' + esc(id) + '">' + ICONS.trash + ' Delete</button>';
    html += '<button class="btn btn-close-detail" data-id="' + esc(id) + '">' + ICONS.close + '</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="detail-body">';

    // Metadata section
    html += '<div class="detail-section">';
    html += '<div class="detail-section-title">Envelope Details</div>';
    html += '<div class="meta-grid">';
    html += metaItem('Envelope ID', id, true);
    html += metaItem('Status', '<span class="status-badge status-' + esc(status) + '">' + esc(status) + '</span>');
    html += metaItem('Created', formatTimestamp(env.createdDateTime || env.created));
    html += metaItem('Sent', formatTimestamp(env.sentDateTime || env.sent));
    html += metaItem('Delivered', formatTimestamp(env.deliveredDateTime));
    html += metaItem('Completed', formatTimestamp(env.completedDateTime));
    if (env.voidedReason) html += metaItem('Voided Reason', env.voidedReason);
    if (env.declinedReason) html += metaItem('Declined Reason', env.declinedReason);
    html += '</div>';
    html += '</div>';

    // Recipients section
    if (recips.length > 0) {
      html += '<div class="detail-section">';
      html += '<div class="detail-section-title">Recipients (' + recips.length + ')</div>';
      html += '<table class="data-table">';
      html += '<thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Order</th></tr></thead>';
      html += '<tbody>';
      recips.forEach(function (r) {
        var rStatus = (r.status || 'created').toLowerCase();
        html += '<tr>';
        html += '<td>' + esc(r.name || r.userName || '-') + '</td>';
        html += '<td>' + esc(r.email || '-') + '</td>';
        html += '<td>' + esc(r.recipientType || r.type || '-') + '</td>';
        html += '<td><span class="status-badge status-' + esc(rStatus) + '">' + esc(rStatus) + '</span></td>';
        html += '<td>' + esc(r.routingOrder || '-') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    // Documents section
    if (docs.length > 0) {
      html += '<div class="detail-section">';
      html += '<div class="detail-section-title">Documents (' + docs.length + ')</div>';
      docs.forEach(function (doc) {
        html += '<div class="doc-item">';
        html += '<span class="doc-icon">' + ICONS.doc + '</span>';
        html += '<span class="doc-name">' + esc(doc.name || doc.documentId || 'Untitled') + '</span>';
        if (doc.documentId) html += '<span class="doc-id">ID: ' + esc(doc.documentId) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Raw JSON section
    html += '<div class="detail-section">';
    html += '<button class="json-toggle" data-id="' + esc(id) + '">';
    html += '<span class="chevron' + (isJsonOpen ? ' open' : '') + '">&#9654;</span> Raw JSON';
    html += '</button>';
    if (isJsonOpen) {
      html += '<pre class="json-block">' + highlightJson(env) + '</pre>';
    }
    html += '</div>';

    html += '</div>'; // detail-body
    return html;
  }

  function metaItem(label, value, isMono) {
    return '<div class="meta-item">' +
      '<span class="meta-label">' + esc(label) + '</span>' +
      '<span class="meta-value' + (isMono ? ' mono' : '') + '">' + (value || '-') + '</span>' +
      '</div>';
  }

  function renderEmptyState() {
    return '<div class="empty-state">' +
      ICONS.emptyPig +
      '<h3>No envelopes yet</h3>' +
      '<p>DocuHog is waiting for envelopes. Send a request to the mock DocuSign API and it will appear here.</p>' +
      '</div>';
  }

  function renderTemplatesTab() {
    return '<div class="empty-state">' +
      ICONS.emptyPig +
      '<h3>Templates</h3>' +
      '<p>Template management will appear here once templates are created through the API.</p>' +
      '</div>';
  }

  // ---------------------------------------------------------------------------
  // Event binding (after render)
  // ---------------------------------------------------------------------------
  function bindListEvents() {
    // Search
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.searchQuery = this.value;
        state.selectedIndex = -1;
        render();
        // Re-focus the newly rendered input
        var newInput = document.getElementById('search-input');
        if (newInput) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = newInput.value.length; }
      });
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = this.getAttribute('data-status');
        state.statusFilter = s || null;
        state.selectedIndex = -1;
        render();
      });
    });

    // Envelope items
    document.querySelectorAll('.envelope-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        state.selectedIndex = idx;
        toggleExpand(id);
      });
    });

    // Delete all
    var btnDeleteAll = document.getElementById('btn-delete-all');
    if (btnDeleteAll) {
      btnDeleteAll.addEventListener('click', function () {
        confirm('Delete all envelopes?', 'This will permanently remove all captured envelopes. This cannot be undone.').then(function (ok) {
          if (ok) deleteAllEnvelopes().catch(function () { toast('Failed to delete', true); });
        });
      });
    }

    // Delete single
    document.querySelectorAll('.btn-delete-one').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        confirm('Delete envelope?', 'This will permanently remove this envelope.').then(function (ok) {
          if (ok) deleteEnvelope(id).catch(function () { toast('Failed to delete', true); });
        });
      });
    });

    // Close detail
    document.querySelectorAll('.btn-close-detail').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.expandedId = null;
        render();
      });
    });

    // JSON toggle
    document.querySelectorAll('.json-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        state.jsonVisible[id] = !state.jsonVisible[id];
        render();
      });
    });
  }

  function toggleExpand(id) {
    if (state.expandedId === id) {
      state.expandedId = null;
    } else {
      state.expandedId = id;
    }
    render();
  }

  // ---------------------------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------------------------
  function initTabs() {
    document.querySelectorAll('.nav-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.activeTab = this.getAttribute('data-tab');
        document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        render();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------
  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Don't interfere with typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
          return;
        }
        return;
      }

      // Don't fire when a dialog is open
      if (document.querySelector('.confirm-overlay')) return;

      var filtered = filteredEnvelopes();

      switch (e.key) {
        case 'j':
          e.preventDefault();
          if (filtered.length === 0) return;
          state.selectedIndex = Math.min(state.selectedIndex + 1, filtered.length - 1);
          render();
          scrollToSelected();
          break;

        case 'k':
          e.preventDefault();
          if (filtered.length === 0) return;
          state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
          render();
          scrollToSelected();
          break;

        case 'Enter':
          e.preventDefault();
          if (state.selectedIndex >= 0 && state.selectedIndex < filtered.length) {
            var env = filtered[state.selectedIndex];
            var id = env.envelopeId || env.id;
            toggleExpand(id);
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (state.expandedId) {
            state.expandedId = null;
            render();
          }
          break;

        case '/':
          e.preventDefault();
          var input = document.getElementById('search-input');
          if (input) input.focus();
          break;
      }
    });
  }

  function scrollToSelected() {
    var items = document.querySelectorAll('.envelope-item');
    if (items[state.selectedIndex]) {
      items[state.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-refresh
  // ---------------------------------------------------------------------------
  function startRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(function () {
      loadEnvelopes();
    }, REFRESH_INTERVAL);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    initTabs();
    initKeyboard();
    loadEnvelopes();
    startRefresh();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
