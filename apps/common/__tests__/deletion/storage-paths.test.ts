import {
  gsUriToStoragePath,
  storagePathsFromCheckpointMedia,
  storagePathFromMessageFile,
} from '../../src/lib/deletion/storage-paths';
import type { Message } from '../../src/types';

describe('deletion storage-paths', () => {
  it('parses gsURI to storage path', () => {
    expect(
      gsUriToStoragePath('gs://bucket/documents/user1/file.pdf')
    ).toBe('documents/user1/file.pdf');
  });

  it('collects checkpoint media paths', () => {
    const paths = storagePathsFromCheckpointMedia([
      {
        id: 'a',
        url: 'https://example.com/a.jpg',
        gsURI: 'gs://bucket/uploads/u1/p1/checkpoints/a.jpg',
        contentType: 'image/jpeg',
        storagePath: 'uploads/u1/p1/checkpoints/a.jpg',
      },
    ]);
    expect(paths).toContain('uploads/u1/p1/checkpoints/a.jpg');
  });

  it('collects message file gsURI paths', () => {
    const msg = {
      id: 'm1',
      role: 'user',
      content: 'hi',
      file: {
        name: 'x.pdf',
        type: 'application/pdf',
        url: 'https://example.com',
        gsURI: 'gs://bucket/documents/u1/x.pdf',
      },
    } as Message;
    expect(storagePathFromMessageFile(msg)).toEqual(['documents/u1/x.pdf']);
  });
});
