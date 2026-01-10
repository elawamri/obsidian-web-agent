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
  },
  
  // Fetch all tags from the vault using the tags/ endpoint
  async fetchVaultTags(onProgress) {
    try {
      if (onProgress) {
        onProgress('Fetching tags from vault...');
      }
      
      const url = `${this.apiUrl}/tags/`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        console.error('Failed to fetch tags, status:', response.status);
        return null;
      }
      
      const data = await response.json();
      
      // The forked plugin returns tags as an array
      if (Array.isArray(data)) {
        return data.sort();
      }
      
      // Fallback if the response format is different
      if (data.tags && Array.isArray(data.tags)) {
        return data.tags.sort();
      }
      
      console.error('Unexpected tags response format:', data);
      return null;
    } catch (error) {
      console.error('Failed to fetch vault tags:', error);
      return null;
    }
  },
  
  // Fetch all note templates from the vault
  async fetchVaultTemplates(templatePattern, onProgress) {
    try {
      if (onProgress) {
        onProgress('Searching for note templates...');
      }
      
      // Default pattern: files ending with "Note Template.md"
      const pattern = templatePattern || '.*Note Template\\.md$';
      const regex = new RegExp(pattern, 'i');
      
      const allTemplates = [];
      const foldersToVisit = ['']; // Start from root
      let visited = 0;
      
      while (foldersToVisit.length > 0) {
        const currentPath = foldersToVisit.pop();
        visited++;
        
        if (onProgress) {
          onProgress(`Scanning for templates... (${visited} folders checked, ${allTemplates.length} found)`);
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
              if (item.endsWith('/')) {
                // Directory - add to queue
                const folderName = item.slice(0, -1);
                const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                
                if (!folderName.startsWith('.') && folderName !== 'node_modules') {
                  foldersToVisit.push(fullPath);
                }
              } else if (item.endsWith('.md')) {
                // Markdown file - check if it matches template pattern
                const fullPath = currentPath ? `${currentPath}/${item}` : item;
                
                if (regex.test(item)) {
                  // Extract template name (remove path and .md extension)
                  const templateName = item.replace(/\.md$/, '');
                  allTemplates.push({
                    name: templateName,
                    path: fullPath
                  });
                }
              }
            });
          }
        } catch (err) {
          console.log(`Failed to read folder: ${currentPath}`, err);
        }
      }
      
      return allTemplates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to fetch vault templates:', error);
      return null;
    }
  },
  
  // Fetch template file content
  async fetchTemplateContent(templatePath) {
    try {
      const url = `${this.apiUrl}/vault/${encodeURIComponent(templatePath)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.status}`);
      }
      
      const content = await response.text();
      return content;
    } catch (error) {
      console.error('Failed to fetch template content:', error);
      throw error;
    }
  }
};

// Export for use in other modules
window.VaultIntegration = VaultIntegration;
