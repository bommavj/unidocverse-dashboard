// app/services/folder.service.ts
import { Injectable } from '@angular/core';

export interface Folder {
  name: string;
  color: string;
  count: number;
  isCustom: boolean;
}

@Injectable({ providedIn: 'root' })
export class FolderService {
  private readonly STORAGE_KEY = 'udv_custom_folders';
  
  private readonly DOC_FOLDER_KEY = 'udv_doc_folders';

  getDocFolder(docId: string): string {
    try {
      const map = JSON.parse(localStorage.getItem(this.DOC_FOLDER_KEY) || '{}');
      return map[docId] || '';
    } catch { return ''; }
  }

  assignDocsToFolder(docIds: string[], folderName: string): void {
    try {
      const map = JSON.parse(localStorage.getItem(this.DOC_FOLDER_KEY) || '{}');
      docIds.forEach(id => { map[id] = folderName; });
      localStorage.setItem(this.DOC_FOLDER_KEY, JSON.stringify(map));
    } catch {}
  }

  removeDocFromFolder(docId: string): void {
    try {
      const map = JSON.parse(localStorage.getItem(this.DOC_FOLDER_KEY) || '{}');
      delete map[docId];
      localStorage.setItem(this.DOC_FOLDER_KEY, JSON.stringify(map));
    } catch {}
  }


  getFolders(): string[] {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  addFolder(name: string): void {
    const folders = this.getFolders();
    if (!folders.includes(name)) {
      folders.push(name);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(folders));
    }
  }

  deleteFolder(name: string): void {
    const folders = this.getFolders().filter(f => f !== name);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(folders));
  }

  renameFolder(oldName: string, newName: string): void {
    const folders = this.getFolders().map(f => f === oldName ? newName : f);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(folders));
  }

  countInFolder(docs: any[], folderName: string): number {
    try {
      const map = JSON.parse(localStorage.getItem(this.DOC_FOLDER_KEY) || '{}');
      return docs.filter((d: any) => map[d.id] === folderName).length;
    } catch { return 0; }
  }
}