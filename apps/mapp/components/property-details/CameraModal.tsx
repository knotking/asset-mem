import * as React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { CameraView } from 'expo-camera';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { X, SwitchCamera } from 'lucide-react-native';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (uri: string) => void;
}

export function CameraModal({ visible, onClose, onVideoRecorded }: CameraModalProps) {
  const cameraRef = React.useRef<CameraView>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [facing, setFacing] = React.useState<'front' | 'back'>('back');
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60,
        });

        if (video?.uri) {
          onVideoRecorded(video.uri);
        }
      } catch (error) {
        console.error('Error recording video:', error);
      } finally {
        setIsRecording(false);
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      try {
        cameraRef.current.stopRecording();
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    onClose();
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} mode="video" facing={facing} mute={true}>
          {/* Header with close and flip buttons */}
          <View
            style={{
              position: 'absolute',
              top: 50,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
            }}>
            <Button onPress={handleClose} variant="ghost" size="icon">
              <Icon as={X} size={24} color="white" />
            </Button>
            {isRecording && (
              <View
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.9)',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'white',
                  }}
                />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  {formatTime(recordingTime)}
                </Text>
              </View>
            )}
            {!isRecording && (
              <Button onPress={toggleCameraFacing} variant="ghost" size="icon">
                <Icon as={SwitchCamera} size={24} color="white" />
              </Button>
            )}
          </View>

          {/* Bottom controls */}
          <View
            style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={isRecording ? stopRecording : startRecording}
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: isRecording ? '#dc2626' : 'white',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4,
                  borderColor: 'white',
                }}>
                {isRecording && (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: 'white',
                      borderRadius: 4,
                    }}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}
