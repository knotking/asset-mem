import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraType, VideoQuality, type CameraCapturedPicture, type CameraRecordingOptions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { AlertCircle, Camera as CameraIcon, Circle, RefreshCw, StopCircle, Video as VideoIcon } from 'lucide-react-native';

type CameraMode = 'photo' | 'video';

type CameraCaptureModalProps = {
  visible: boolean;
  initialMode: CameraMode;
  onClose: () => void;
  onCapture: (asset: ImagePicker.ImagePickerAsset) => void;
  onError?: (message: string) => void;
};

export function CameraCaptureModal({
  visible,
  initialMode,
  onClose,
  onCapture,
  onError,
}: CameraCaptureModalProps) {
  const defaultCameraType =
    (CameraType?.back as CameraType | undefined) ??
    (Camera?.Constants?.Type?.back as CameraType | undefined) ??
    ('back' as CameraType);

  const cameraRef = useRef<Camera | null>(null);
  const shouldSaveRecordingRef = useRef(true);

  const [mode, setMode] = useState<CameraMode>(initialMode);
  const [cameraType, setCameraType] = useState<CameraType>(defaultCameraType);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [cameraPermission, requestCameraPermission] = Camera.useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = Camera.useMicrophonePermissions();

  const ensurePermissions = useCallback(
    async (targetMode: CameraMode) => {
      setIsRequestingPermissions(true);
      try {
        let hasCamera = cameraPermission?.granted ?? false;
        if (!hasCamera) {
          const permissionResult = await requestCameraPermission();
          hasCamera = permissionResult?.granted ?? false;
        }

        if (!hasCamera) {
          onError?.('Please grant permission to access your camera.');
          return false;
        }

        if (targetMode === 'video') {
          let hasMicrophone = microphonePermission?.granted ?? false;
          if (!hasMicrophone) {
            const micResult = await requestMicrophonePermission();
            hasMicrophone = micResult?.granted ?? false;
          }

          if (!hasMicrophone) {
            onError?.('Please grant permission to access your microphone.');
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error('Permission error:', error);
        onError?.('Unable to access camera. Please check your device permissions.');
        return false;
      } finally {
        setIsRequestingPermissions(false);
      }
    },
    [cameraPermission?.granted, microphonePermission?.granted, onError, requestCameraPermission, requestMicrophonePermission]
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!visible) {
      setActionError(null);
      setIsCameraReady(false);
      if (isRecording && cameraRef.current) {
        shouldSaveRecordingRef.current = false;
        cameraRef.current.stopRecording();
      }
      setIsRecording(false);
      return;
    }

    (async () => {
      const allowed = await ensurePermissions(initialMode);
      if (!allowed) {
        onClose();
      }
    })();
  }, [ensurePermissions, initialMode, isRecording, onClose, visible]);

  const handleModeChange = useCallback(
    async (nextMode: CameraMode) => {
      if (mode === nextMode || isRecording) {
        return;
      }

      if (nextMode === 'video') {
        const allowed = await ensurePermissions('video');
        if (!allowed) {
          return;
        }
      }

      setActionError(null);
      setMode(nextMode);
    },
    [ensurePermissions, isRecording, mode]
  );

  const handleClose = useCallback(
    (options?: { discardRecording?: boolean }) => {
      if (isRecording && cameraRef.current) {
        shouldSaveRecordingRef.current = !(options?.discardRecording ?? false);
        cameraRef.current.stopRecording();
      }
      onClose();
    },
    [isRecording, onClose]
  );

  const buildPhotoAsset = useCallback(
    (photo: CameraCapturedPicture): ImagePicker.ImagePickerAsset => {
      const timestamp = Date.now();
      return {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        fileName: `homeapp-photo-${timestamp}.jpg`,
        type: 'image',
        mimeType: 'image/jpeg',
      };
    },
    []
  );

  const handleCapturePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isRecording) {
      return;
    }

    try {
      setActionError(null);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: false,
      });

      if (!photo) {
        return;
      }

      onCapture(buildPhotoAsset(photo));
    } catch (error) {
      console.error('Failed to capture photo:', error);
      setActionError('Failed to capture photo. Please try again.');
    }
  }, [buildPhotoAsset, isCameraReady, isRecording, onCapture]);

  const buildVideoAsset = useCallback((uri: string, durationMs?: number): ImagePicker.ImagePickerAsset => {
    const timestamp = Date.now();
    const extension = Platform.OS === 'ios' ? 'mov' : 'mp4';
    const mimeType = Platform.OS === 'ios' ? 'video/quicktime' : 'video/mp4';

    return {
      uri,
      fileName: `homeapp-video-${timestamp}.${extension}`,
      type: 'video',
      mimeType,
      duration: durationMs ? durationMs / 1000 : undefined,
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) {
      return;
    }

    const allowed = await ensurePermissions('video');
    if (!allowed) {
      return;
    }

    setActionError(null);
    setIsRecording(true);
    shouldSaveRecordingRef.current = true;

    try {
      const options: CameraRecordingOptions = {
        quality: VideoQuality['1080p'],
        maxDuration: 60,
        mute: false,
      };

      const result = await cameraRef.current.recordAsync(options);

      if (result && shouldSaveRecordingRef.current) {
        onCapture(buildVideoAsset(result.uri, result.durationMs));
      }
    } catch (error) {
      if (shouldSaveRecordingRef.current) {
        console.error('Failed to record video:', error);
        setActionError('Failed to record video. Please try again.');
      }
    } finally {
      setIsRecording(false);
      shouldSaveRecordingRef.current = true;
    }
  }, [buildVideoAsset, ensurePermissions, isRecording, onCapture]);

  const handleStopRecording = useCallback(() => {
    shouldSaveRecordingRef.current = true;
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  }, [isRecording]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => handleClose({ discardRecording: true })}
    >
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1">
          <View className="px-4 pb-3">
            <Text className="text-lg font-semibold text-white">Use your camera</Text>
            <Text className="mt-1 text-sm text-white/70">
              {mode === 'photo' ? 'Capture a photo to share in the chat.' : 'Record a short video to share in the chat.'}
            </Text>

            <View className="mt-4 flex-row flex-wrap items-center justify-between gap-3">
              <View className="flex-row gap-2">
                <Button
                  variant={mode === 'photo' ? 'secondary' : 'outline'}
                  size="sm"
                  onPress={() => handleModeChange('photo')}
                  disabled={isRecording || isRequestingPermissions}
                  className={mode === 'photo' ? 'bg-white text-black' : ''}
                >
                  <Text className={mode === 'photo' ? 'text-black' : 'text-white'}>Photo</Text>
                </Button>
                <Button
                  variant={mode === 'video' ? 'secondary' : 'outline'}
                  size="sm"
                  onPress={() => handleModeChange('video')}
                  disabled={isRecording || isRequestingPermissions}
                  className={mode === 'video' ? 'bg-white text-black' : ''}
                >
                  <Text className={mode === 'video' ? 'text-black' : 'text-white'}>Video</Text>
                </Button>
              </View>
              <Button
                variant="outline"
                size="sm"
                onPress={() =>
                  setCameraType((prev) =>
                    (prev ?? defaultCameraType) === (CameraType?.back ?? 'back')
                      ? ((CameraType?.front ?? 'front') as CameraType)
                      : ((CameraType?.back ?? 'back') as CameraType)
                  )
                }
                disabled={isRecording}
                className="border-white/30 bg-white/10"
              >
                <RefreshCw className="mr-2 h-4 w-4 text-white" />
                <Text className="text-white">Switch camera</Text>
              </Button>
              {isRecording && (
                <View className="flex-row items-center gap-1 rounded-full bg-red-500/20 px-2 py-1">
                  <Circle className="h-3 w-3 text-red-500" fill="#ef4444" />
                  <Text className="text-xs font-medium text-red-400">Recording…</Text>
                </View>
              )}
            </View>
          </View>

          <View className="mx-4 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black">
            <Camera
              ref={(ref) => {
                cameraRef.current = ref;
              }}
              style={styles.cameraPreview}
              type={cameraType}
              ratio="16:9"
              onCameraReady={() => setIsCameraReady(true)}
            />

            {(!isCameraReady || isRequestingPermissions) && (
              <View className="absolute inset-0 items-center justify-center bg-black/80">
                <Text className="text-sm text-white/80">Initializing camera…</Text>
              </View>
            )}
          </View>

          {actionError && (
            <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <Text className="text-sm text-red-200">{actionError}</Text>
            </View>
          )}

          <View className="mt-6 flex-row items-center justify-between px-6 pb-6">
            <Button variant="ghost" onPress={() => handleClose({ discardRecording: true })}>
              <Text className="text-white">Cancel</Text>
            </Button>

            {mode === 'photo' ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleCapturePhoto}
                disabled={!isCameraReady || isRecording}
                className="h-16 w-16 items-center justify-center rounded-full bg-white"
              >
                <CameraIcon className="h-7 w-7 text-black" />
              </Pressable>
            ) : isRecording ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleStopRecording}
                className="h-16 w-16 items-center justify-center rounded-full bg-red-500"
              >
                <StopCircle className="h-7 w-7 text-white" />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={handleStartRecording}
                disabled={!isCameraReady}
                className="h-16 w-16 items-center justify-center rounded-full bg-white"
              >
                <VideoIcon className="h-7 w-7 text-black" />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraPreview: {
    flex: 1,
  },
});

