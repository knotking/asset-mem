import * as React from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ImagePickerAsset } from 'expo-image-picker';
import {
  Camera,
  CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
  type PermissionResponse,
} from 'expo-camera';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  Camera as CameraIcon,
  Circle,
  RefreshCw,
  StopCircle,
  Video,
  X,
} from 'lucide-react-native';

const VIDEO_MAX_DURATION_SECONDS = 60;

export type CameraCaptureModalProps = {
  visible: boolean;
  initialMode: 'photo' | 'video';
  onClose: () => void;
  onCapture: (asset: ImagePickerAsset) => Promise<void> | void;
};

export function CameraCaptureModal({ visible, initialMode, onClose, onCapture }: CameraCaptureModalProps) {
  const cameraRef = React.useRef<Camera | null>(null);
  const [cameraType, setCameraType] = React.useState<CameraType>(CameraType.back);
  const [mode, setMode] = React.useState<'photo' | 'video'>(initialMode);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isRequestingPermissions, setIsRequestingPermissions] = React.useState(false);
  const shouldSaveRecordingRef = React.useRef(true);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const resetState = React.useCallback(() => {
    shouldSaveRecordingRef.current = true;
    setIsRecording(false);
    setErrorMessage(null);
    setIsCameraReady(false);
  }, []);

  React.useEffect(() => {
    if (visible) {
      setMode(initialMode);
      resetState();
      setCameraType(CameraType.back);
    }
  }, [visible, initialMode, resetState]);

  const ensurePermissions = React.useCallback(async () => {
    if (!visible) return false;

    const request = async (
      current: PermissionResponse | null | undefined,
      requester: (() => Promise<PermissionResponse>) | undefined,
      failureMessage: string,
    ) => {
      if (current?.granted) {
        return true;
      }
      if (!requester) {
        setErrorMessage(failureMessage);
        return false;
      }
      setIsRequestingPermissions(true);
      try {
        const response = await requester();
        if (!response.granted) {
          setErrorMessage(failureMessage);
          return false;
        }
        return true;
      } catch (err) {
        console.error('Permission request failed:', err);
        setErrorMessage(failureMessage);
        return false;
      } finally {
        setIsRequestingPermissions(false);
      }
    };

    const cameraGranted = await request(
      cameraPermission,
      requestCameraPermission,
      'Camera permission is required to capture media.',
    );

    if (!cameraGranted) {
      return false;
    }

    if (mode === 'video') {
      const microphoneGranted = await request(
        microphonePermission,
        requestMicrophonePermission,
        'Microphone permission is required to record videos.',
      );
      if (!microphoneGranted) {
        return false;
      }
    }

    setErrorMessage(null);
    return true;
  }, [cameraPermission, microphonePermission, mode, requestCameraPermission, requestMicrophonePermission, visible]);

  React.useEffect(() => {
    if (visible) {
      // Kick off permission requests proactively when the modal opens or mode changes.
      ensurePermissions();
    }
  }, [visible, mode, ensurePermissions]);

  const stopRecording = React.useCallback(
    (shouldSave: boolean) => {
      shouldSaveRecordingRef.current = shouldSave;
      if (cameraRef.current) {
        try {
          cameraRef.current.stopRecording();
        } catch (err) {
          console.warn('Error stopping recording:', err);
        }
      }
    },
    [],
  );

  const handleClose = React.useCallback(() => {
    if (isRecording) {
      stopRecording(false);
    }
    onClose();
  }, [isRecording, stopRecording, onClose]);

  const handleCapturePhoto = React.useCallback(async () => {
    if (!cameraRef.current) return;

    const permissionsReady = await ensurePermissions();
    if (!permissionsReady) {
      return;
    }

    try {
      setErrorMessage(null);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        setErrorMessage('Unable to capture photo. Please try again.');
        return;
      }

      const timestamp = Date.now();
      const asset: ImagePickerAsset = {
        type: 'image',
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        fileName: `homeapp-photo-${timestamp}.jpg`,
        mimeType: 'image/jpeg',
      };

      try {
        await Promise.resolve(onCapture(asset));
        onClose();
      } catch (err) {
        console.error('Camera capture handling error:', err);
        setErrorMessage('Failed to process captured media. Please try again.');
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      setErrorMessage('Failed to capture photo. Please try again.');
    }
  }, [ensurePermissions, onCapture, onClose]);

  const startRecording = React.useCallback(async () => {
    if (!cameraRef.current || isRecording) return;

    const permissionsReady = await ensurePermissions();
    if (!permissionsReady) {
      return;
    }

    try {
      setErrorMessage(null);
      setIsRecording(true);
      shouldSaveRecordingRef.current = true;

      const video = await cameraRef.current.recordAsync({
        maxDuration: VIDEO_MAX_DURATION_SECONDS,
        quality: Camera.Constants.VideoQuality['720p'] ?? undefined,
      });

      if (!video?.uri || !shouldSaveRecordingRef.current) {
        return;
      }

      const timestamp = Date.now();
      const asset: ImagePickerAsset = {
        type: 'video',
        uri: video.uri,
        duration: video.duration ?? undefined,
        fileName: `homeapp-video-${timestamp}.mp4`,
        mimeType: 'video/mp4',
      };

      try {
        await Promise.resolve(onCapture(asset));
        onClose();
      } catch (err) {
        console.error('Video capture handling error:', err);
        setErrorMessage('Failed to process recorded video. Please try again.');
      }
    } catch (err) {
      if (shouldSaveRecordingRef.current) {
        console.error('Video recording error:', err);
        setErrorMessage('Failed to record video. Please try again.');
      }
    } finally {
      setIsRecording(false);
      shouldSaveRecordingRef.current = true;
    }
  }, [ensurePermissions, isRecording, onCapture, onClose]);

  const handleStopRecording = React.useCallback(() => {
    if (!isRecording) return;
    stopRecording(true);
  }, [isRecording, stopRecording]);

  const handleToggleMode = React.useCallback(
    (nextMode: 'photo' | 'video') => {
      if (mode === nextMode || isRecording) return;
      setMode(nextMode);
    },
    [isRecording, mode],
  );

  const handleSwitchCamera = React.useCallback(() => {
    if (isRecording) return;
    setCameraType((current) => (current === CameraType.back ? CameraType.front : CameraType.back));
  }, [isRecording]);

  const canAskCameraPermission = cameraPermission?.canAskAgain ?? true;
  const requiresCameraPermission = !cameraPermission?.granted;
  const requiresMicrophonePermission = mode === 'video' && !microphonePermission?.granted;

  const renderPermissionPrompt = () => {
    if (!visible) return null;

    const promptMessage = requiresCameraPermission
      ? 'Camera access is required to capture photos or videos.'
      : 'Microphone access is required to record videos.';

    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Icon as={CameraIcon} size={48} className="mb-4 text-white/60" />
        <Text className="mb-4 text-center text-base text-white">{promptMessage}</Text>
        <View className="w-full gap-3">
          {(requiresCameraPermission && canAskCameraPermission) || requiresMicrophonePermission ? (
            <Button
              onPress={() => {
                void ensurePermissions();
              }}
              disabled={isRequestingPermissions}
              className="bg-white/10">
              {isRequestingPermissions ? 'Requesting permission…' : 'Allow access'}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onPress={() => Linking.openSettings()}
            className="border-white/30 bg-transparent">
            Open settings
          </Button>
          <Button variant="ghost" onPress={handleClose} className="bg-transparent">
            Cancel
          </Button>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1">
          {requiresCameraPermission || requiresMicrophonePermission ? (
            renderPermissionPrompt()
          ) : (
            <View className="flex-1">
              <Camera
                ref={(ref) => {
                  cameraRef.current = ref;
                }}
                style={{ flex: 1 }}
                type={cameraType}
                onCameraReady={() => setIsCameraReady(true)}
                ratio="16:9"
              />

              {!isCameraReady && (
                <View className="absolute inset-0 items-center justify-center bg-black/80">
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text className="mt-3 text-base text-white">Initializing camera…</Text>
                </View>
              )}

              <View className="absolute inset-0 justify-between">
                <View className="flex-row items-center justify-between px-4 pt-4">
                  <Pressable
                    onPress={handleClose}
                    accessibilityLabel="Close camera"
                    className="rounded-full bg-black/60 p-2">
                    <Icon as={X} size={20} className="text-white" />
                  </Pressable>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => handleToggleMode('photo')}
                      disabled={isRecording}
                      className={`rounded-full px-3 py-1 ${
                        mode === 'photo' ? 'bg-white/20' : 'bg-black/50'
                      }`}>
                      <Text className="text-sm font-medium text-white">Photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleMode('video')}
                      disabled={isRecording}
                      className={`rounded-full px-3 py-1 ${
                        mode === 'video' ? 'bg-white/20' : 'bg-black/50'
                      }`}>
                      <Text className="text-sm font-medium text-white">Video</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={handleSwitchCamera}
                    disabled={isRecording}
                    accessibilityLabel="Switch camera"
                    className="rounded-full bg-black/60 p-2">
                    <Icon as={RefreshCw} size={20} className="text-white" />
                  </Pressable>
                </View>

                <View className="items-center gap-3 pb-10">
                  {errorMessage && (
                    <View className="mx-6 mb-2 rounded-full bg-black/60 px-3 py-1">
                      <Text className="text-sm text-red-400">{errorMessage}</Text>
                    </View>
                  )}
                  {mode === 'photo' ? (
                    <Pressable
                      onPress={handleCapturePhoto}
                      accessibilityLabel="Capture photo"
                      disabled={!isCameraReady}
                      className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80">
                      <Icon as={CameraIcon} size={32} className="text-white" />
                    </Pressable>
                  ) : isRecording ? (
                    <Pressable
                      onPress={handleStopRecording}
                      accessibilityLabel="Stop recording"
                      className="h-20 w-20 items-center justify-center rounded-full bg-red-600">
                      <Icon as={StopCircle} size={40} className="text-white" />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={startRecording}
                      accessibilityLabel="Start recording"
                      disabled={!isCameraReady}
                      className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80">
                      <Icon as={Video} size={32} className="text-white" />
                    </Pressable>
                  )}
                  {mode === 'video' && (
                    <Text className="text-xs text-white/80">Maximum duration {VIDEO_MAX_DURATION_SECONDS} seconds</Text>
                  )}
                  {isRecording && (
                    <View className="flex-row items-center gap-2">
                      <Icon as={Circle} size={12} className="text-red-500" />
                      <Text className="text-sm font-medium text-white">Recording…</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
