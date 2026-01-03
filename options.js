// Obsidian Web Agent - Options Page Logic

const defaultSettings = {
  vaultPath: '',
  defaultLocation: 'Books',
  defaultSignificance: 3,
  localRestApiUrl: 'http://127.0.0.1:27123',
  localRestApiKey: '',
  vaultFolders: [
    'Books',
    'Articles',
    'Notes'
  ],
  vaultTags: [
    'book',
    'article',
    'fiction',
    'non-fiction',
    'to-read'
  ],
  genreMapping: {
    'Fiction': 'Literature',
    'Science Fiction': 'Computer-Science, Science-Fiction',
    'Fantasy': 'Literature, Fantasy',
    'History': 'History',
    'Philosophy': 'Philosophy',
    'Computer Science': 'Computer-Science',
    'Programming': 'Computer-Science, Software-Engineering',
    'Biography': 'Biography',
    'Self Help': 'Psychology, Self-Improvement',
    'Business': 'Economics, Business',
    'Science': 'Science',
    'Politics': 'Politics',
    'Economics': 'Economics',
    'Sociology': 'Sociology',
    'Psychology': 'Psychology',
    'Neuroscience': 'Neuroscience',
    'Mathematics': 'Mathematics',
    'Physics': 'Physics',
    'Biology': 'Biology'
  }
};

// Load settings and populate form
async function loadSettings() {
  const settings = await chrome.storage.sync.get(defaultSettings);
  
  document.getElementById('vaultPath').value = settings.vaultPath;
  document.getElementById('defaultLocation').value = settings.defaultLocation;
  document.getElementById('defaultSignificance').value = settings.defaultSignificance;
  document.getElementById('vaultFolders').value = (settings.vaultFolders || []).join('\n');
  document.getElementById('vaultTags').value = settings.vaultTags.join('\n');
  document.getElementById('genreMapping').value = JSON.stringify(settings.genreMapping, null, 2);
  
  // Load API settings - auto-correct old HTTPS URL to HTTP
  let apiUrl = settings.localRestApiUrl || defaultSettings.localRestApiUrl;
  if (apiUrl === 'https://127.0.0.1:27124') {
    apiUrl = 'http://127.0.0.1:27123'; // Auto-correct to HTTP
  }
  document.getElementById('localRestApiUrl').value = apiUrl;
  document.getElementById('localRestApiKey').value = settings.localRestApiKey || '';
}

// Save settings
async function saveSettings(e) {
  e.preventDefault();
  
  try {
    const genreMappingText = document.getElementById('genreMapping').value;
    let genreMapping;
    
    try {
      genreMapping = JSON.parse(genreMappingText);
    } catch (error) {
      alert('Invalid JSON in Genre Mapping. Please check the format.');
      return;
    }
    // Parse vault tags
    const vaultTagsText = document.getElementById('vaultTags').value;
    const vaultTags = vaultTagsText
      .split(/[\n,]/)
      .map(t => t.trim())
      .filter(Boolean);
    // Parse vault folders
    const vaultFoldersText = document.getElementById('vaultFolders').value;
    const vaultFolders = vaultFoldersText
      .split(/[\n,]/)
      .map(t => t.trim())
      .filter(Boolean);
    
    const settings = {
      vaultPath: document.getElementById('vaultPath').value,
      defaultLocation: document.getElementById('defaultLocation').value,
      defaultSignificance: parseInt(document.getElementById('defaultSignificance').value),
      localRestApiUrl: document.getElementById('localRestApiUrl').value || defaultSettings.localRestApiUrl,
      localRestApiKey: document.getElementById('localRestApiKey').value || '',
      vaultFolders: vaultFolders,
      vaultTags: vaultTags,
      genreMapping: genreMapping
    };
    
    await chrome.storage.sync.set(settings);
    
    console.log('Settings saved:', settings); // Debug log
    
    // Show save confirmation
    const status = document.getElementById('saveStatus');
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 2000);
    
  } catch (error) {
    alert('Failed to save settings: ' + error.message);
  }
}

// Reset to defaults
async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    await chrome.storage.sync.set(defaultSettings);
    await loadSettings();
    
    const status = document.getElementById('saveStatus');
    status.textContent = '✓ Reset to defaults!';
    status.classList.add('show');
    setTimeout(() => {
      status.textContent = '✓ Saved!';
      status.classList.remove('show');
    }, 2000);
  }
}

// Sync vault data from Obsidian Local REST API
async function syncVaultData() {
  const syncBtn = document.getElementById('syncBtn');
  const syncStatus = document.getElementById('syncStatus');
  
  // Show loading state
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Syncing...';
  syncStatus.className = 'sync-status loading';
  syncStatus.textContent = 'Connecting to Obsidian...';
  
  try {
    // Save API settings first
    const apiUrl = document.getElementById('localRestApiUrl').value || defaultSettings.localRestApiUrl;
    const apiKey = document.getElementById('localRestApiKey').value || '';
    
    // Check if API key is provided
    if (!apiKey.trim()) {
      throw new Error('API Key is required!\n\nPlease copy your API key from Obsidian:\nSettings → Local REST API → "How to Access"');
    }
    
    await chrome.storage.sync.set({
      localRestApiUrl: apiUrl,
      localRestApiKey: apiKey
    });
    
    // Initialize VaultIntegration with current settings
    VaultIntegration.apiUrl = apiUrl;
    VaultIntegration.apiKey = apiKey;
    
    // Check connection first
    syncStatus.textContent = 'Checking connection to Local REST API...';
    const isConnected = await VaultIntegration.checkConnection();
    
    if (!isConnected) {
      throw new Error('Cannot connect to Obsidian. Make sure:\n1. Obsidian is running\n2. Local REST API plugin is installed and enabled\n3. Enable "Non-encrypted (HTTP) Server" in plugin settings\n4. The API URL is correct (default: http://127.0.0.1:27123)');
    }
    
    // Fetch folders with progress updates
    const folders = await VaultIntegration.fetchVaultFolders((progress) => {
      syncStatus.textContent = progress;
    });
    
    // Update the folder field
    if (folders && folders.length > 0) {
      document.getElementById('vaultFolders').value = folders.join('\n');
    }
    
    // Fetch tags with progress updates
    const tags = await VaultIntegration.fetchVaultTags((progress) => {
      syncStatus.textContent = progress;
    });
    
    // Update the tags field
    if (tags && tags.length > 0) {
      document.getElementById('vaultTags').value = tags.join('\n');
    }
    
    // Show success
    syncStatus.className = 'sync-status success';
    syncStatus.innerHTML = `✅ <strong>Sync successful!</strong><br>
      📂 ${folders ? folders.length : 0} folders found<br>
      🏷️ ${tags ? tags.length : 0} tags synced<br>
      <em>Don't forget to click "Save Settings" to keep these changes!</em>`;
    
  } catch (error) {
    console.error('Sync error:', error);
    syncStatus.className = 'sync-status error';
    syncStatus.innerHTML = `❌ <strong>Sync failed:</strong><br>${error.message.replace(/\n/g, '<br>')}`;
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 Sync from Obsidian';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
  document.getElementById('syncBtn').addEventListener('click', syncVaultData);
});
