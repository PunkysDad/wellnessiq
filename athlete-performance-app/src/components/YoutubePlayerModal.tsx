import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { IconButton, ActivityIndicator } from 'react-native-paper';
import YoutubeIframe from 'react-native-youtube-iframe';
import { getAuth } from 'firebase/auth';
import { appTheme } from '../theme/appTheme';
import { YoutubeVideoResult } from '../interfaces/interfaces';
import ENV_CONFIG from '../config/environment';

interface YoutubePlayerModalProps {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
  workoutId: number;
  savedVideoId?: string;
  savedVideoTitle?: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PLAYER_HEIGHT = (SCREEN_WIDTH - 32) * (9 / 16);

const extractVideoId = (urlOrId: string): string => {
  const match = urlOrId.match(/[?&]v=([^&]+)/);
  return match ? match[1] : urlOrId;
};

export default function YoutubePlayerModal({ visible, exerciseName, onClose, workoutId, savedVideoId, savedVideoTitle }: YoutubePlayerModalProps) {
  const [results, setResults] = useState<YoutubeVideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setResults([]);
      setSelectedVideoId(null);
      setError(false);
      setSaving(false);
      setJustSaved(false);
      setCurrentSavedId(null);
      return;
    }

    const resolvedSavedId = savedVideoId ? extractVideoId(savedVideoId) : null;
    setCurrentSavedId(resolvedSavedId);

    if (resolvedSavedId) {
      setSelectedVideoId(resolvedSavedId);
      return;
    }

    const fetchVideos = async () => {
      setLoading(true);
      setError(false);
      try {
        const firebaseUser = getAuth().currentUser;
        if (!firebaseUser) {
          setError(true);
          return;
        }
        const token = await firebaseUser.getIdToken();
        const url = `${ENV_CONFIG.BACKEND_URL}/api/v1/youtube/search?query=${encodeURIComponent(exerciseName)}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setError(true);
          return;
        }

        const data = await response.json();
        const videos: YoutubeVideoResult[] = Array.isArray(data) ? data : data?.data ?? [];
        if (videos.length === 0) {
          setError(true);
        } else {
          setResults(videos.slice(0, 5));
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [visible, exerciseName, savedVideoId]);

  const handleBackToResults = useCallback(() => {
    setSelectedVideoId(null);
    setJustSaved(false);
  }, []);

  const handleSaveVideo = async () => {
    if (!selectedVideoId) return;
    setSaving(true);
    try {
      const selectedVideo = results.find(v => v.videoId === selectedVideoId);
      const videoTitle = selectedVideo?.title ?? null;
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) return;
      const token = await firebaseUser.getIdToken();
      const url = `${ENV_CONFIG.BACKEND_URL}/api/v1/workouts/${workoutId}/exercises/video`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          exerciseName,
          videoId: selectedVideoId,
          videoUrl: `https://www.youtube.com/watch?v=${selectedVideoId}`,
          videoTitle,
        }),
      });
      if (response.ok) {
        setCurrentSavedId(selectedVideoId);
        setJustSaved(true);
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  };

  const isCurrentVideoSaved = selectedVideoId !== null && selectedVideoId === currentSavedId;

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={appTheme.red} />
          <Text style={styles.loadingText}>Searching videos...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No videos found for this exercise</Text>
        </View>
      );
    }

    if (selectedVideoId) {
      return (
        <View>
          {results.length > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBackToResults}>
              <Text style={styles.backButtonText}>← Back to results</Text>
            </TouchableOpacity>
          )}
          <View style={styles.playerContainer}>
            <YoutubeIframe
              height={PLAYER_HEIGHT}
              width={SCREEN_WIDTH - 32}
              videoId={selectedVideoId}
              play={true}
            />
          </View>
          <View style={styles.saveSection}>
            {justSaved ? (
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>Saved!</Text>
              </View>
            ) : isCurrentVideoSaved ? (
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>Saved ✓</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.5 }]}
                onPress={handleSaveVideo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={appTheme.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return (
      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {results.map((video) => (
          <TouchableOpacity
            key={video.videoId}
            style={styles.resultItem}
            onPress={() => { setSelectedVideoId(video.videoId); setJustSaved(false); }}
          >
            <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} />
            <View style={styles.resultInfo}>
              <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
              <Text style={styles.channelName}>{video.channelName}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>{exerciseName}</Text>
              {isCurrentVideoSaved && selectedVideoId && (
                <View style={styles.savedHeaderBadge}>
                  <Text style={styles.savedHeaderBadgeText}>Saved</Text>
                </View>
              )}
            </View>
            <IconButton icon="close" size={20} iconColor={appTheme.white} onPress={onClose} />
          </View>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'flex-start',
    paddingTop: SCREEN_HEIGHT * 0.12,
  },
  container: {
    backgroundColor: appTheme.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
    padding: 16,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appTheme.white,
    flexShrink: 1,
  },
  savedHeaderBadge: {
    backgroundColor: appTheme.success + '20',
    borderWidth: 1,
    borderColor: appTheme.success,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  savedHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: appTheme.success,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: appTheme.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: appTheme.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  resultsList: {
    maxHeight: 400,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: appTheme.bgElevated,
  },
  thumbnail: {
    width: 120,
    height: 68,
    borderRadius: 6,
    backgroundColor: appTheme.navyDark,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: appTheme.text,
    marginBottom: 4,
  },
  channelName: {
    fontSize: 12,
    color: appTheme.textMuted,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  backButtonText: {
    color: appTheme.purple,
    fontSize: 15,
    fontWeight: '600',
  },
  playerContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
  },
  saveSection: {
    marginTop: 12,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: appTheme.purple,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: appTheme.white,
    fontSize: 15,
    fontWeight: '600',
  },
  savedBadge: {
    backgroundColor: appTheme.success + '20',
    borderWidth: 1,
    borderColor: appTheme.success,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  savedBadgeText: {
    color: appTheme.success,
    fontSize: 15,
    fontWeight: '600',
  },
});
