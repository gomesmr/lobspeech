/**
 * Google Drive Client-Side Integration for AI Studio Web
 * Uses Google Identity Services (GSI) Token Client & Drive REST API v3
 */

import firebaseConfig from '../../firebase-applet-config.json';

const DRIVE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive';

export interface DriveUploadProgress {
  step: 'idle' | 'authorizing' | 'creating_folder' | 'uploading_files' | 'completed' | 'error';
  message: string;
  folderId?: string;
  folderUrl?: string;
  uploadedFilesCount?: number;
  totalFiles?: number;
  error?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveSessionRecord {
  sessionId: string;
  folderId: string;
  folderName: string;
  folderUrl: string;
  createdAt: string;
  audioFiles: Array<{
    id: string;
    name: string;
    webViewLink?: string;
    sizeBytes?: number;
  }>;
  totalCharacters: number;
  voice: string;
  format: string;
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private rootFolderId: string | null = null;

  /**
   * Checks if an access token is valid
   */
  public hasValidToken(): boolean {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt - 60000);
  }

  /**
   * Request an OAuth access token using Google Identity Services (GIS)
   */
  public async getAccessToken(interactive: boolean = true): Promise<string> {
    if (this.hasValidToken() && this.accessToken) {
      return this.accessToken;
    }

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
        // Fallback or wait for script load
        const scriptId = 'google-gsi-client';
        let script = document.getElementById(scriptId) as HTMLScriptElement;
        
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }

        const checkGsi = setInterval(() => {
          if ((window as any).google?.accounts?.oauth2) {
            clearInterval(checkGsi);
            this.requestGsiToken(interactive, resolve, reject);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkGsi);
          if (!(window as any).google?.accounts?.oauth2) {
            reject(new Error('Biblioteca Google Identity Services não carregou a tempo.'));
          }
        }, 5000);
      } else {
        this.requestGsiToken(interactive, resolve, reject);
      }
    });
  }

  private requestGsiToken(interactive: boolean, resolve: (token: string) => void, reject: (err: any) => void) {
    try {
      const clientId = (firebaseConfig as any)?.oAuthClientId || '57284722548-gsmtj0s5cva61a8nlfmc6kigtasugu12.apps.googleusercontent.com';
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }
          this.accessToken = tokenResponse.access_token;
          const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3600;
          this.tokenExpiresAt = Date.now() + expiresIn * 1000;
          resolve(this.accessToken!);
        },
      });

      if (interactive) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        tokenClient.requestAccessToken({ prompt: 'none' });
      }
    } catch (err) {
      reject(err);
    }
  }

  /**
   * Finds or creates the root application folder: "TTS API Audio Sessions"
   */
  public async getOrCreateRootFolder(): Promise<string> {
    if (this.rootFolderId) return this.rootFolderId;

    const token = await this.getAccessToken(false).catch(() => this.getAccessToken(true));
    
    // Search if folder already exists
    const query = "mimeType = 'application/vnd.google-apps.folder' and name = 'TTS API Audio Sessions' and trashed = false";
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        this.rootFolderId = data.files[0].id;
        return this.rootFolderId!;
      }
    }

    // Create root folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'TTS API Audio Sessions',
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Pastas de sessões geradas automaticamente pelo Text-to-Speech API Backend',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Falha ao criar pasta raiz no Google Drive: ${createRes.statusText}`);
    }

    const created = await createRes.json();
    this.rootFolderId = created.id;
    return this.rootFolderId!;
  }

  /**
   * Creates a dedicated session folder named [UUID]-[random-slug]
   */
  public async createSessionFolder(folderName: string): Promise<DriveFolderInfo> {
    const rootFolderId = await this.getOrCreateRootFolder();
    const token = await this.getAccessToken(false);

    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
      description: `Sessão de áudio TTS gerada em ${new Date().toLocaleString()}`,
    };

    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Falha ao criar pasta de sessão no Drive.');
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
    };
  }

  /**
   * Uploads a file (Blob or text JSON) into a specific Google Drive folder using Multipart upload
   */
  public async uploadFile(
    folderId: string,
    filename: string,
    content: Blob | string,
    mimeType: string
  ): Promise<{ id: string; name: string; webViewLink?: string; sizeBytes?: number }> {
    const token = await this.getAccessToken(false);

    const fileBlob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

    const metadata = {
      name: filename,
      parents: [folderId],
      mimeType,
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const mediaPartHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

    const metadataBlob = new Blob([metadataPart], { type: 'text/plain' });
    const mediaHeaderBlob = new Blob([mediaPartHeader], { type: 'text/plain' });
    const closeBlob = new Blob([closeDelimiter], { type: 'text/plain' });

    const multipartBody = new Blob([metadataBlob, mediaHeaderBlob, fileBlob, closeBlob]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Falha no upload do arquivo ${filename}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink,
      sizeBytes: parseInt(data.size, 10) || fileBlob.size,
    };
  }

  /**
   * Upload an entire TTS session (all chunk audio files + metadata json) to Google Drive
   */
  public async saveCompleteSessionToDrive(
    folderName: string,
    sessionData: {
      sessionId: string;
      baseName: string;
      voice: string;
      language: string;
      speed: number;
      format: string;
      text: string;
      chunks: Array<{
        index: number;
        filename: string;
        blob: Blob;
        mimeType: string;
        textFull: string;
      }>;
    },
    onProgress?: (progress: DriveUploadProgress) => void
  ): Promise<DriveSessionRecord> {
    try {
      onProgress?.({
        step: 'authorizing',
        message: 'Obtendo autorização com o Google Drive...',
      });

      await this.getAccessToken(true);

      onProgress?.({
        step: 'creating_folder',
        message: `Criando pasta da sessão: ${folderName}...`,
      });

      const folder = await this.createSessionFolder(folderName);
      const uploadedFiles: Array<{ id: string; name: string; webViewLink?: string; sizeBytes?: number }> = [];

      const totalFiles = sessionData.chunks.length + 1; // chunks + metadata.json
      let currentFileIndex = 0;

      // 1. Upload audio chunks
      for (const chunk of sessionData.chunks) {
        currentFileIndex++;
        onProgress?.({
          step: 'uploading_files',
          message: `Enviando arquivo ${chunk.filename} (${currentFileIndex}/${totalFiles})...`,
          folderId: folder.id,
          folderUrl: folder.webViewLink,
          uploadedFilesCount: currentFileIndex,
          totalFiles,
        });

        const uploadedChunk = await this.uploadFile(
          folder.id,
          chunk.filename,
          chunk.blob,
          chunk.mimeType
        );
        uploadedFiles.push(uploadedChunk);
      }

      // 2. Upload metadata json
      currentFileIndex++;
      const metadataPayload = {
        sessionId: sessionData.sessionId,
        folderName,
        createdAt: new Date().toISOString(),
        promptText: sessionData.text,
        totalCharacters: sessionData.text.length,
        totalChunks: sessionData.chunks.length,
        voice: sessionData.voice,
        language: sessionData.language,
        speed: sessionData.speed,
        format: sessionData.format,
        files: uploadedFiles,
      };

      onProgress?.({
        step: 'uploading_files',
        message: `Salvando metadados session-metadata.json (${currentFileIndex}/${totalFiles})...`,
        folderId: folder.id,
        folderUrl: folder.webViewLink,
        uploadedFilesCount: currentFileIndex,
        totalFiles,
      });

      const metaFile = await this.uploadFile(
        folder.id,
        'session-metadata.json',
        JSON.stringify(metadataPayload, null, 2),
        'application/json'
      );
      uploadedFiles.push(metaFile);

      const record: DriveSessionRecord = {
        sessionId: sessionData.sessionId,
        folderId: folder.id,
        folderName: folder.name,
        folderUrl: folder.webViewLink,
        createdAt: new Date().toISOString(),
        audioFiles: uploadedFiles,
        totalCharacters: sessionData.text.length,
        voice: sessionData.voice,
        format: sessionData.format,
      };

      onProgress?.({
        step: 'completed',
        message: `Sessão salva com sucesso no Google Drive!`,
        folderId: folder.id,
        folderUrl: folder.webViewLink,
        uploadedFilesCount: totalFiles,
        totalFiles,
      });

      return record;
    } catch (err: any) {
      onProgress?.({
        step: 'error',
        message: err.message || 'Erro ao sincronizar com Google Drive.',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Lists all audio sessions and their files directly from Google Drive
   */
  public async listSessionsFromGoogleDrive(interactive: boolean = false): Promise<any[]> {
    try {
      const token = await this.getAccessToken(interactive);
      if (!token) return [];

      const rootFolderId = await this.getOrCreateRootFolder();
      
      // Query subfolders inside root folder
      const query = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webViewLink, createdTime, modifiedTime)&orderBy=createdTime desc&pageSize=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        console.warn('Falha ao listar pastas de sessões no Drive:', res.statusText);
        return [];
      }

      const data = await res.json();
      const folderList = data.files || [];
      const sessionResults: any[] = [];

      for (const folder of folderList) {
        try {
          // List files inside session folder
          const filesRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folder.id}' in parents and trashed = false`)}&fields=files(id, name, mimeType, webViewLink, size, createdTime)`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!filesRes.ok) continue;

          const filesData = await filesRes.json();
          const rawFiles = filesData.files || [];

          // Natural sorting ascending (e.g. audio-01, audio-02, ..., audio-10, audio-13)
          const files = [...rawFiles].sort((a: any, b: any) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );

          const metaFile = files.find((f: any) => f.name === 'session-metadata.json');
          const audioFiles = files.filter((f: any) => f.name !== 'session-metadata.json');

          let metaContent: any = null;
          if (metaFile) {
            try {
              const metaContentRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${metaFile.id}?alt=media`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (metaContentRes.ok) {
                metaContent = await metaContentRes.json();
              }
            } catch (e) {
              console.warn('Erro ao ler session-metadata.json:', e);
            }
          }

          // Parse folder name parts [UUID]-[slug]
          const folderName = folder.name;
          const uuidMatch = folderName.match(/^([0-9a-fA-F-]{36})-(.+)$/);
          const sessionId = metaContent?.sessionId || (uuidMatch ? uuidMatch[1] : folder.id);
          const slug = uuidMatch ? uuidMatch[2] : folderName;

          const sessionObj = {
            sessionId,
            slug,
            fullSessionId: folderName,
            folderName,
            customTitle: metaContent?.customTitle || undefined,
            driveFolderId: folder.id,
            driveFolderUrl: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
            createdAt: metaContent?.createdAt || folder.createdTime || new Date().toISOString(),
            baseName: metaContent?.baseName || audioFiles[0]?.name?.replace(/-\d+\.[a-zA-Z0-9]+$/, '') || 'audio',
            voice: metaContent?.voice || 'Kore',
            language: metaContent?.language || 'pt-BR',
            speed: metaContent?.speed || 1.0,
            format: metaContent?.format || (audioFiles[0]?.name?.split('.').pop() || 'mp3'),
            text: metaContent?.promptText || `Sessão de áudio com ${audioFiles.length} arquivos gerados.`,
            totalCharacters: metaContent?.totalCharacters || 0,
            totalDurationSeconds: metaContent?.totalDurationSeconds || 0,
            totalChunks: metaContent?.totalChunks || audioFiles.length || 1,
            chunksCount: audioFiles.length,
            driveFiles: files.map((f: any) => ({
              id: f.id,
              name: f.name,
              webViewLink: f.webViewLink,
              sizeBytes: parseInt(f.size, 10) || 0,
            })),
            isSavedToDrive: true,
          };

          sessionResults.push(sessionObj);
        } catch (fErr) {
          console.warn(`Erro ao processar pasta ${folder.name}:`, fErr);
        }
      }

      return sessionResults;
    } catch (err) {
      console.warn('Erro ao listar do Google Drive:', err);
      return [];
    }
  }

  /**
   * Fetches an audio file from Google Drive as a playable Blob
   */
  public async fetchAudioBlob(fileId: string, interactive: boolean = false): Promise<{ blob: Blob; url: string; mimeType: string }> {
    let token = await this.getAccessToken(interactive).catch(() => this.getAccessToken(true));
    let res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      token = await this.getAccessToken(true);
      res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (!res.ok) {
      throw new Error(`Falha ao carregar áudio do Drive (${res.status}): ${res.statusText}`);
    }
    const blob = await res.blob();
    const mimeType = res.headers.get('Content-Type') || 'audio/mpeg';
    const url = URL.createObjectURL(blob);
    return { blob, url, mimeType };
  }

  /**
   * Deletes a single file from Google Drive
   */
  public async deleteFile(fileId: string, interactive: boolean = false): Promise<boolean> {
    try {
      let token = await this.getAccessToken(interactive).catch(() => this.getAccessToken(true));
      let res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        token = await this.getAccessToken(true);
        res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (!res.ok && res.status !== 404) {
        console.warn(`Erro ao deletar arquivo no Drive (${res.status})`);
      }
      return true;
    } catch (err) {
      console.warn('Falha na exclusão do arquivo no Drive:', err);
      return false;
    }
  }

  /**
   * Deletes a folder and all its contents from Google Drive
   */
  public async deleteFolder(folderId: string, interactive: boolean = false): Promise<boolean> {
    try {
      let token = await this.getAccessToken(interactive).catch(() => this.getAccessToken(true));
      let res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        token = await this.getAccessToken(true);
        res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (!res.ok && res.status !== 404) {
        console.warn(`Erro ao deletar pasta no Drive (${res.status})`);
      }
      return true;
    } catch (err) {
      console.warn('Falha na exclusão da pasta no Drive:', err);
      return false;
    }
  }

  /**
   * Renames a folder in Google Drive
   */
  public async renameFolder(folderId: string, newName: string, interactive: boolean = false): Promise<boolean> {
    try {
      let token = await this.getAccessToken(interactive).catch(() => this.getAccessToken(true));
      let res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });
      if (res.status === 401 || res.status === 403) {
        token = await this.getAccessToken(true);
        res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newName }),
        });
      }
      return res.ok;
    } catch (err) {
      console.warn('Falha ao renomear pasta no Drive:', err);
      return false;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
