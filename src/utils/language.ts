export type SupportedLanguage = 'zh-TW' | 'zh-CN' | 'en';

export function getLanguageId(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    // TypeScript/JavaScript
    'ts': 'typescript',
    'tsx': 'typescript',
    'mts': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    
    // Python
    'py': 'python',
    'pyw': 'python',
    
    // C/C++
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'hpp': 'cpp',
    'hxx': 'cpp',
    'cc': 'cpp',
    
    // C#
    'cs': 'csharp',
    
    // Go
    'go': 'go',
    
    // Lua
    'lua': 'lua',
    
    // Java
    'java': 'java',
    
    // Rust
    'rs': 'rust',
    
    // Ruby
    'rb': 'ruby',
    
    // PHP
    'php': 'php',
    
    // Swift
    'swift': 'swift',
    
    // Kotlin
    'kt': 'kotlin',
    'kts': 'kotlin',
    
    // HTML/CSS
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    
    // JSON/YAML
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    
    // Markdown
    'md': 'markdown',
    'markdown': 'markdown',
    
    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'ps1': 'powershell',
  };
  
  return languageMap[ext] || 'plaintext';
}

export function getTestFileExtension(language: string): string {
  const testExtensions: Record<string, string> = {
    'typescript': '.test.ts',
    'javascript': '.test.js',
    'python': '_test.py',
    'go': '_test.go',
    'csharp': '.Tests.cs',
    'java': 'Test.java',
    'rust': '_test.rs',
    'ruby': '_test.rb',
    'php': 'Test.php',
  };
  
  return testExtensions[language] || '.test.txt';
}

export function getTestFramework(language: string): string {
  const frameworks: Record<string, string> = {
    'typescript': 'Jest',
    'javascript': 'Jest',
    'python': 'pytest',
    'go': 'Go testing package',
    'csharp': 'xUnit/NUnit/MSTest',
    'java': 'JUnit',
    'rust': 'Rust built-in test',
    'ruby': 'RSpec',
    'php': 'PHPUnit',
  };
  
  return frameworks[language] || 'Unknown';
}