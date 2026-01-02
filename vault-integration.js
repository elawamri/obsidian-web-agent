// Obsidian Web Agent - Vault Integration Module
// Connects to Obsidian via Local REST API plugin

const VaultIntegration = {
  // Default API settings - Use HTTP by default (simpler, no certificate issues)
  apiUrl: 'http://127.0.0.1:27123',
  apiKey: '',
  
  // Check if Local REST API is available
  async checkConnection() {
    try {
      console.log('Attempting connection to:', this.apiUrl);
      
      const response = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        headers: this.getHeaders(),
        mode: 'cors'
      });
      
      console.log('Response status:', response.status);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key is required or invalid. Please check your API key.');
      }
      
      const data = await response.json();
      
      // Check if authenticated
      if (data.authenticated === false) {
        throw new Error('Not authenticated. Please make sure your API key is correct.');
      }
      
      return response.ok;
    } catch (error) {
      console.error('Connection error:', error);
      // Re-throw auth errors
      if (error.message.includes('API Key') || error.message.includes('authenticated')) {
        throw error;
      }
      // Network errors (CORS, connection refused, etc.)
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Cannot reach Obsidian API.\nMake sure Obsidian is running and HTTP server is enabled on port 27123.');
      }
      return false;
    }
  },
  
  // Get headers with API key
  getHeaders() {
    const headers = {
      'Accept': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  },
  
  // Recursively fetch all folders from the vault
  async fetchVaultFolders(onProgress) {
    try {
      const allFolders = new Set();
      const foldersToVisit = ['']; // Start from root
      let visited = 0;
      
      while (foldersToVisit.length > 0) {
        const currentPath = foldersToVisit.pop();
        visited++;
        
        // Progress callback
        if (onProgress) {
          onProgress(`Scanning folders... (${visited} checked, ${allFolders.size} found)`);
        }
        
        const url = currentPath 
          ? `${this.apiUrl}/vault/${encodeURIComponent(currentPath)}/`
          : `${this.apiUrl}/vault/`;
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders()
          });
          
          if (!response.ok) {
            continue;
          }
          
          const data = await response.json();
          
          if (data.files) {
            data.files.forEach(item => {
              // Items ending with / are directories
              if (item.endsWith('/')) {
                const folderName = item.slice(0, -1); // Remove trailing slash
                const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                
                // Skip hidden folders and common non-note folders
                if (!folderName.startsWith('.') && folderName !== 'node_modules') {
                  allFolders.add(fullPath);
                  foldersToVisit.push(fullPath);
                }
              }
            });
          }
        } catch (err) {
          console.log(`Failed to read folder: ${currentPath}`, err);
          // Continue with other folders
        }
      }
      
      return Array.from(allFolders).sort();
    } catch (error) {
      console.error('Failed to fetch vault folders:', error);
      return null;
    }
  }
};

// Export for use in other modules
window.VaultIntegration = VaultIntegration;
