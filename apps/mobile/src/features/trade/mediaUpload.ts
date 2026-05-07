import { api } from '../../lib/api';

export type SelectedLocalImage = {
  uri: string;
  name: string;
  type: string;
};

type UploadResponse = { media: { id: string } };

export async function uploadSelectedImages(images: SelectedLocalImage[]) {
  const ids: string[] = [];
  for (const image of images) {
    const formData = new FormData();
    formData.append('image', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    const response = await api.media.uploadImage(formData) as UploadResponse;
    ids.push(response.media.id);
  }
  return ids;
}
