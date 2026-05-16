import * as React from 'react';
import { Modal, View, Pressable, Platform, ScrollView, Animated } from 'react-native';
import { CameraView, VideoQuality, VideoCodec } from 'expo-camera';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { X, SwitchCamera, Zap, ZapOff, Plus, Minus, Settings, Mic, MicOff } from 'lucide-react-native';
import { createLogger } from '@/lib/logger';

const cameraLog = createLogger('camera');

export interface CameraSettings {
  // Video quality and performance
  videoQuality?: VideoQuality;
  videoBitrate?: number;
  videoStabilizationMode?: 'off' | 'standard' | 'cinematic' | 'auto';

  // Recording options
  maxDuration?: number;
  maxFileSize?: number;
  codec?: VideoCodec; // iOS only

  // Camera controls
  flash?: 'off' | 'on' | 'auto';
  enableTorch?: boolean;
  autofocus?: 'on' | 'off';
  zoom?: number; // 0-1
  mirror?: boolean;
  mute?: boolean;

  // Display options
  ratio?: '4:3' | '16:9' | '1:1';
}

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (uri: string) => void;
  settings?: CameraSettings;
}

const defaultSettings: CameraSettings = {
  videoQuality: '1080p',
  videoStabilizationMode: 'auto',
  maxDuration: 60,
  flash: 'off',
  enableTorch: false,
  autofocus: 'on',
  zoom: 0,
  mirror: false,
  mute: true,
};

export function CameraModal({ visible, onClose, onVideoRecorded, settings = {} }: CameraModalProps) {
  const mergedSettings = { ...defaultSettings, ...settings };

  const cameraRef = React.useRef<CameraView>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [facing, setFacing] = React.useState<'front' | 'back'>('back');
  const [flash, setFlash] = React.useState<'off' | 'on' | 'auto'>(mergedSettings.flash || 'off');
  const [enableTorch, setEnableTorch] = React.useState(mergedSettings.enableTorch || false);
  const [zoom, setZoom] = React.useState(mergedSettings.zoom || 0);
  const [showSettings, setShowSettings] = React.useState(false);

  // Editable settings
  const [videoQuality, setVideoQuality] = React.useState<VideoQuality>(mergedSettings.videoQuality || '1080p');
  const [stabilization, setStabilization] = React.useState<'off' | 'standard' | 'cinematic' | 'auto'>(mergedSettings.videoStabilizationMode || 'auto');
  const [mute, setMute] = React.useState(mergedSettings.mute ?? true);
  const [aspectRatio, setAspectRatio] = React.useState<'4:3' | '16:9' | '1:1'>(mergedSettings.ratio || '16:9');
  const [maxDuration, setMaxDuration] = React.useState(mergedSettings.maxDuration || 60);

  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset settings when modal becomes visible or settings prop changes
  React.useEffect(() => {
    if (visible) {
      setVideoQuality(mergedSettings.videoQuality || '1080p');
      setStabilization(mergedSettings.videoStabilizationMode || 'auto');
      setMute(mergedSettings.mute ?? true);
      setAspectRatio(mergedSettings.ratio || '16:9');
      setMaxDuration(mergedSettings.maxDuration || 60);
      setFlash(mergedSettings.flash || 'off');
      setEnableTorch(mergedSettings.enableTorch || false);
      setZoom(mergedSettings.zoom || 0);
      setFacing('back');
      setShowSettings(false);
    }
  }, [visible, mergedSettings.videoQuality, mergedSettings.videoStabilizationMode, mergedSettings.mute, mergedSettings.ratio, mergedSettings.maxDuration, mergedSettings.flash, mergedSettings.enableTorch, mergedSettings.zoom]);

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
        const recordOptions: any = {
          maxDuration: maxDuration,
        };

        // Add optional recording parameters
        if (mergedSettings.maxFileSize) {
          recordOptions.maxFileSize = mergedSettings.maxFileSize;
        }
        if (mergedSettings.mirror !== undefined) {
          recordOptions.mirror = mergedSettings.mirror;
        }
        if (Platform.OS === 'ios' && mergedSettings.codec) {
          recordOptions.codec = mergedSettings.codec;
        }

        const video = await cameraRef.current.recordAsync(recordOptions);

        if (video?.uri) {
          onVideoRecorded(video.uri);
        }
      } catch (error) {
        cameraLog.error('video.record.failed', undefined, error);
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
        cameraLog.error('video.stop.failed', undefined, error);
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

  const toggleFlash = () => {
    setFlash((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const toggleTorch = () => {
    setEnableTorch((current) => !current);
  };

  const handleZoomIn = () => {
    setZoom((current) => Math.min(1, current + 0.1));
  };

  const handleZoomOut = () => {
    setZoom((current) => Math.max(0, current - 0.1));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          mode="video"
          facing={facing}
          mute={mute}
          zoom={zoom}
          flash={flash}
          enableTorch={enableTorch}
          autofocus={mergedSettings.autofocus}
          videoQuality={videoQuality}
          videoStabilizationMode={stabilization}
          mirror={mergedSettings.mirror}
          ratio={aspectRatio}
          {...(mergedSettings.videoBitrate && { videoBitrate: mergedSettings.videoBitrate })}>
          {/* Header with controls */}
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
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button onPress={() => setShowSettings(!showSettings)} variant="ghost" size="icon">
                  <Icon as={Settings} size={24} color={showSettings ? '#3b82f6' : 'white'} />
                </Button>
                <Button onPress={toggleFlash} variant="ghost" size="icon">
                  <Icon as={flash === 'off' ? ZapOff : Zap} size={24} color="white" />
                  {flash === 'auto' && (
                    <Text style={{ color: 'white', fontSize: 10, position: 'absolute', bottom: 0 }}>
                      A
                    </Text>
                  )}
                </Button>
                <Button onPress={toggleTorch} variant="ghost" size="icon">
                  <Icon as={Zap} size={24} color={enableTorch ? 'yellow' : 'white'} />
                </Button>
                <Button onPress={toggleCameraFacing} variant="ghost" size="icon">
                  <Icon as={SwitchCamera} size={24} color="white" />
                </Button>
              </View>
            )}
          </View>

          {/* Side controls - Zoom */}
          {!isRecording && !showSettings && (
            <View
              style={{
                position: 'absolute',
                right: 20,
                top: '40%',
                alignItems: 'center',
                gap: 12,
              }}>
              <Button onPress={handleZoomIn} variant="ghost" size="icon">
                <Icon as={Plus} size={24} color="white" />
              </Button>
              <Text style={{ color: 'white', fontSize: 12 }}>
                {Math.round(zoom * 100)}%
              </Text>
              <Button onPress={handleZoomOut} variant="ghost" size="icon">
                <Icon as={Minus} size={24} color="white" />
              </Button>
            </View>
          )}

          {/* Settings Panel */}
          {showSettings && !isRecording && (
            <Animated.View
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                top: 120,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                borderRadius: 24,
                padding: 20,
                maxHeight: '60%',
              }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
                  Camera Settings
                </Text>

                {/* Video Quality */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>
                    VIDEO QUALITY
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(['480p', '720p', '1080p', '4K'] as VideoQuality[]).map((quality) => (
                      <Pressable
                        key={quality}
                        onPress={() => setVideoQuality(quality)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: videoQuality === quality ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: videoQuality === quality ? '#3b82f6' : 'transparent',
                        }}>
                        <Text style={{ color: 'white', fontSize: 14, fontWeight: videoQuality === quality ? '600' : '400' }}>
                          {quality}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Stabilization */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>
                    STABILIZATION
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(['off', 'standard', 'cinematic', 'auto'] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        onPress={() => setStabilization(mode)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: stabilization === mode ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: stabilization === mode ? '#10b981' : 'transparent',
                        }}>
                        <Text style={{ color: 'white', fontSize: 14, fontWeight: stabilization === mode ? '600' : '400', textTransform: 'capitalize' }}>
                          {mode}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Aspect Ratio */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>
                    ASPECT RATIO
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['16:9', '4:3', '1:1'] as const).map((ratio) => (
                      <Pressable
                        key={ratio}
                        onPress={() => setAspectRatio(ratio)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: aspectRatio === ratio ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: aspectRatio === ratio ? '#8b5cf6' : 'transparent',
                          alignItems: 'center',
                        }}>
                        <Text style={{ color: 'white', fontSize: 14, fontWeight: aspectRatio === ratio ? '600' : '400' }}>
                          {ratio}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Audio Toggle */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>
                    AUDIO
                  </Text>
                  <Pressable
                    onPress={() => setMute(!mute)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: 16,
                      borderRadius: 12,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Icon as={mute ? MicOff : Mic} size={20} color="white" />
                      <Text style={{ color: 'white', fontSize: 16 }}>
                        {mute ? 'Muted' : 'Recording Audio'}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: mute ? 'rgba(255, 255, 255, 0.2)' : '#10b981',
                        padding: 2,
                        justifyContent: 'center',
                        alignItems: mute ? 'flex-start' : 'flex-end',
                      }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'white' }} />
                    </View>
                  </Pressable>
                </View>

                {/* Max Duration */}
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>
                    MAX DURATION
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[30, 60, 120, 300].map((duration) => (
                      <Pressable
                        key={duration}
                        onPress={() => setMaxDuration(duration)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: maxDuration === duration ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: maxDuration === duration ? '#f59e0b' : 'transparent',
                          alignItems: 'center',
                        }}>
                        <Text style={{ color: 'white', fontSize: 14, fontWeight: maxDuration === duration ? '600' : '400' }}>
                          {duration < 60 ? `${duration}s` : `${duration / 60}m`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          )}

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
