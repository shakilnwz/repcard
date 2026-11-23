export type FsaPermissionMode = 'read' | 'readwrite';

export type FsaPermissionState = 'granted' | 'denied' | 'prompt';

export interface FsaWritableFileStream {
  write(data: string | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

export interface FsaFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable?: () => Promise<FsaWritableFileStream>;
}

export interface FsaDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  entries(): AsyncIterableIterator<[string, FsaHandle]>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FsaDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FsaFileHandle>;
  queryPermission?(descriptor?: {
    mode?: FsaPermissionMode;
  }): Promise<FsaPermissionState>;
  requestPermission?(descriptor?: {
    mode?: FsaPermissionMode;
  }): Promise<FsaPermissionState>;
}

export type FsaHandle = FsaFileHandle | FsaDirectoryHandle;

export interface WindowWithFsa {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: FsaPermissionMode;
    startIn?: string;
  }) => Promise<FsaDirectoryHandle>;
}
