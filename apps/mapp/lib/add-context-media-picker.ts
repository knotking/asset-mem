import * as ImagePicker from 'expo-image-picker';

/** Fast picker options — no crop step; matches property quick-capture flows. */
export const ADD_CONTEXT_GALLERY_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images', 'videos'],
  allowsEditing: false,
  quality: 0.8,
  videoMaxDuration: 60,
};

export const ADD_CONTEXT_CAMERA_PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: false,
  quality: 0.8,
};

export const ADD_CONTEXT_CAMERA_VIDEO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'videos',
  allowsEditing: false,
  quality: 0.8,
  videoMaxDuration: 60,
};

/** Request permissions while the sheet is open so tap-to-picker feels instant. */
export async function warmAddContextMediaPermissions(): Promise<void> {
  const [camera, library] = await Promise.all([
    ImagePicker.getCameraPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
  ]);
  const tasks: Promise<unknown>[] = [];
  if (!camera.granted) {
    tasks.push(ImagePicker.requestCameraPermissionsAsync());
  }
  if (!library.granted) {
    tasks.push(ImagePicker.requestMediaLibraryPermissionsAsync());
  }
  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}
