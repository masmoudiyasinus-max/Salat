import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  Upload,
  Trash2,
  Search,
  Music,
  Headphones,
  ListMusic,
  Edit2,
  Check,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  saveAudioFilesToDB,
  getStoredAudioTracks,
  getAudioTrackBlob,
  updateAudioTrackTitle,
  removeAudioTrack,
  clearAudioLibraryDB,
  getAudioPlayerState,
  saveAudioPlayerState,
  formatFileSize,
  formatAudioDuration,
  AUDIO_EVENTS,
} from '../services/audioStorage.js';

export default function AudioPlayerView({ settings }) {
  const isEn = settings?.language === 'en';

  const [tracks, setTracks] = useState([]);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState('all'); // 'off' | 'all' | 'one'
  const [isShuffle, setIsShuffle] = useState(false);
  const [isPlaylistExpanded, setIsPlaylistExpanded] = useState(true);
  const [folderName, setFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const blobUrlRef = useRef(null);
  const editInputRef = useRef(null);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Load stored tracks and player preferences on boot
  const loadInitialData = useCallback(async () => {
    try {
      const storedTracks = await getStoredAudioTracks();
      setTracks(storedTracks);

      const savedState = getAudioPlayerState();
      setFolderName(savedState.folderName || '');
      setRepeatMode(savedState.repeatMode || 'all');
      setIsShuffle(Boolean(savedState.isShuffle));
      setIsPlaylistExpanded(savedState.isPlaylistExpanded !== undefined ? Boolean(savedState.isPlaylistExpanded) : true);

      if (savedState.activeTrackId && storedTracks.some((t) => t.id === savedState.activeTrackId)) {
        setActiveTrackId(savedState.activeTrackId);
      } else if (storedTracks.length > 0) {
        setActiveTrackId(storedTracks[0].id);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load and prepare active track audio blob
  useEffect(() => {
    let isCancelled = false;

    async function loadAudioSource() {
      if (!activeTrackId) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        return;
      }

      try {
        const blob = await getAudioTrackBlob(activeTrackId);
        if (isCancelled || !blob) return;

        // Revoke previous blob URL to prevent memory leaks
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const newUrl = URL.createObjectURL(blob);
        blobUrlRef.current = newUrl;

        if (audioRef.current) {
          const wasPlaying = isPlayingRef.current;
          audioRef.current.src = newUrl;
          audioRef.current.load();

          if (wasPlaying) {
            audioRef.current
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          }
        }
      } catch {
        // Blob load error
      }
    }

    loadAudioSource();

    return () => {
      isCancelled = true;
    };
  }, [activeTrackId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Save active track selection to state
  useEffect(() => {
    if (activeTrackId) {
      saveAudioPlayerState({ activeTrackId });
    }
  }, [activeTrackId]);

  // Active track object
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0] || null;
  const activeTrackIndex = tracks.findIndex((t) => t.id === activeTrackId);

  // Play / Pause Toggle
  const handleTogglePlay = useCallback(() => {
    if (!audioRef.current || !activeTrackId) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.PLAYBACK_STOPPED));
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.PLAYBACK_STARTED));
        })
        .catch(() => {
          setIsPlaying(false);
        });
    }
  }, [isPlaying, activeTrackId]);

  // Next Track Handler
  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;

    let nextIndex = 0;
    if (isShuffle) {
      if (tracks.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * tracks.length);
        } while (nextIndex === activeTrackIndex);
      }
    } else {
      nextIndex = (activeTrackIndex + 1) % tracks.length;
    }

    setActiveTrackId(tracks[nextIndex].id);
    setIsPlaying(true);
  }, [tracks, activeTrackIndex, isShuffle]);

  // Previous Track Handler
  const handlePrevTrack = useCallback(() => {
    if (tracks.length === 0) return;

    // If more than 3 seconds in, restart current track
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIndex = 0;
    if (isShuffle) {
      if (tracks.length > 1) {
        do {
          prevIndex = Math.floor(Math.random() * tracks.length);
        } while (prevIndex === activeTrackIndex);
      }
    } else {
      prevIndex = (activeTrackIndex - 1 + tracks.length) % tracks.length;
    }

    setActiveTrackId(tracks[prevIndex].id);
    setIsPlaying(true);
  }, [tracks, activeTrackIndex, isShuffle, currentTime]);

  // Seek +/- 10 Seconds
  const handleSeekOffset = (seconds) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration || 0, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Repeat Mode Toggle
  const handleCycleRepeatMode = () => {
    const modes = ['all', 'one', 'off'];
    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(next);
    saveAudioPlayerState({ repeatMode: next });
  };

  // Shuffle Toggle
  const handleToggleShuffle = () => {
    const next = !isShuffle;
    setIsShuffle(next);
    saveAudioPlayerState({ isShuffle: next });
  };

  // Playlist Sidebar Expand/Collapse Toggle
  const handleTogglePlaylist = () => {
    const next = !isPlaylistExpanded;
    setIsPlaylistExpanded(next);
    saveAudioPlayerState({ isPlaylistExpanded: next });
  };

  // Focus and select input on editing start
  useEffect(() => {
    if (isEditingTitle && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle start editing title
  const handleStartEditTitle = () => {
    if (!activeTrack) return;
    setEditTitleValue(activeTrack.title || activeTrack.name || '');
    setIsEditingTitle(true);
  };

  // Handle save title
  const handleSaveTitle = async () => {
    if (!activeTrack) return;
    const trimmed = editTitleValue.trim();
    if (!trimmed) {
      setIsEditingTitle(false);
      return;
    }

    setTracks((prev) =>
      prev.map((t) => (t.id === activeTrack.id ? { ...t, title: trimmed } : t))
    );
    setIsEditingTitle(false);

    try {
      await updateAudioTrackTitle(activeTrack.id, trimmed);
    } catch {
      // Local state already updated
    }
  };

  // Handle cancel editing title
  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditTitleValue('');
  };

  // Track Ended Event Handler
  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (repeatMode === 'all') {
      handleNextTrack();
    } else if (repeatMode === 'off') {
      if (activeTrackIndex < tracks.length - 1) {
        handleNextTrack();
      } else {
        setIsPlaying(false);
        window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.PLAYBACK_STOPPED));
      }
    }
  };

  // Audio files selection via file picker input (supports multiple files from any folder)
  const handleFilesSelect = async (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsLoadingFiles(true);
    try {
      const filesArray = Array.from(fileList);
      const allTracks = await saveAudioFilesToDB(filesArray, isEn ? 'Audio Library' : 'المكتبة الصوتية');
      setTracks(allTracks);
      if (allTracks.length > 0 && !activeTrackId) {
        setActiveTrackId(allTracks[0].id);
        setIsPlaying(false);
      }
    } catch {
      // Storage error
    } finally {
      setIsLoadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    setIsLoadingFiles(true);
    try {
      const filesArray = Array.from(droppedFiles);
      const allTracks = await saveAudioFilesToDB(filesArray, isEn ? 'Audio Library' : 'المكتبة الصوتية');
      setTracks(allTracks);
      if (allTracks.length > 0 && !activeTrackId) {
        setActiveTrackId(allTracks[0].id);
      }
    } catch {
      // Storage error
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Delete track
  const handleDeleteTrack = async (e, trackId) => {
    e.stopPropagation();
    await removeAudioTrack(trackId);
    const updated = await getStoredAudioTracks();
    setTracks(updated);
    if (activeTrackId === trackId) {
      if (updated.length > 0) {
        setActiveTrackId(updated[0].id);
      } else {
        setActiveTrackId(null);
        setIsPlaying(false);
      }
    }
  };

  // Clear library
  const handleClearLibrary = async () => {
    const confirmMsg = isEn
      ? 'Are you sure you want to clear all audio files from the library?'
      : 'هل أنت متأكد من رغبتك في تفريغ كافة الملفات الصوتية من المشغل؟';
    if (window.confirm(confirmMsg)) {
      await clearAudioLibraryDB();
      setTracks([]);
      setActiveTrackId(null);
      setFolderName('');
      setIsPlaying(false);
    }
  };

  // Filtered tracks for playlist search
  const filteredTracks = tracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (t.title && t.title.toLowerCase().includes(q)) || (t.name && t.name.toLowerCase().includes(q));
  });

  // Calculate seek percentage for styling
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="bento-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        maxWidth: '1200px',
        height: 'min(860px, calc(100dvh - 84px))',
        minHeight: 'min(580px, calc(100dvh - 84px))',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={handleTrackEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Hidden Multiple Audio Files Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.flac,.aac,.ogg,.opus,.wma"
        onChange={handleFilesSelect}
        style={{ display: 'none' }}
      />

      {/* 1. Header & Actions Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
            }}
          >
            <Headphones size={22} style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
              {isEn ? 'Audio Library & Player' : 'مشغل الصوتيات والمكتبة الصوتية'}
            </h1>
            <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {isEn
                ? 'Select audio files from your device to play Quran, lectures, and lessons'
                : 'حدد ملفات صوتية من جهازك واستمع للتلاوات والدروس والأذكار مباشرة'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {folderName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                fontSize: '0.80rem',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              <Music size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {folderName}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>({tracks.length})</span>
            </div>
          )}

          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="btn-primary"
            disabled={isLoadingFiles}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              fontSize: '0.86rem',
              fontWeight: '700',
              cursor: isLoadingFiles ? 'wait' : 'pointer',
            }}
          >
            <Upload size={16} />
            <span>{isLoadingFiles ? (isEn ? 'Adding Files...' : 'جاري إضافة الملفات...') : isEn ? 'Add Audio Files' : 'إضافة ملفات صوتية'}</span>
          </button>

          {tracks.length > 0 && (
            <button
              onClick={handleClearLibrary}
              className="btn-secondary"
              title={isEn ? 'Clear Library' : 'تفريغ المكتبة'}
              style={{
                padding: '8px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-missed)',
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* 2. Main Audio Player Body (Now Playing Card + Playlist Sidebar) */}
      {tracks.length === 0 ? (
        /* Empty State / Dropzone */
        <div
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            border: isDragging ? '2px dashed var(--accent)' : '2px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.20)',
            cursor: 'pointer',
            padding: '40px 20px',
            textAlign: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-secondary)',
            }}
          >
            <Music size={36} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', margin: '0 0 6px 0' }}>
              {isEn ? 'No Audio Files Selected' : 'لم يتم اختيار ملفات صوتية بعد'}
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0, maxWidth: '420px' }}>
              {isEn
                ? 'Click here or drag & drop audio files (MP3, WAV, M4A, FLAC) from any folder to start playing instantly.'
                : 'انقر هنا لاختيار ملفات صوتية من جهازك أو اسحب وأفلت مقاطعك الصوتية (MP3، WAV، M4A، FLAC) لتشغيلها محلياً.'}
            </p>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--accent)',
              color: '#000000',
              fontWeight: '800',
              fontSize: '0.90rem',
            }}
          >
            <Upload size={16} />
            <span>{isEn ? 'Select Audio Files' : 'تحديد ملفات صوتية'}</span>
          </div>
        </div>
      ) : (
        /* Bento Grid: Active Player + Playlist */
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: isPlaylistExpanded ? 'minmax(320px, 1fr) minmax(280px, 380px)' : '1fr 64px',
            gap: '18px',
            minHeight: 0,
            overflow: 'hidden',
            transition: 'grid-template-columns 0.25s ease',
          }}
        >
          {/* A. Now Playing Card (Left / Center) */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Spinning Disc / Visualizer Badge */}
            <div
              style={{
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 15, 18, 0.85)',
                border: '3px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPlaying ? '0 0 40px rgba(255, 255, 255, 0.15)' : 'none',
                animation: isPlaying ? 'spin 10s linear infinite' : 'none',
                margin: '10px 0',
                position: 'relative',
              }}
            >
              {/* Inner Vinyl Ring */}
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Music size={24} style={{ color: isPlaying ? '#ffffff' : 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Track Info */}
            <div style={{ textAlign: 'center', width: '100%', padding: '0 10px', minHeight: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '4px',
                }}
              >
                {isEn ? `Track ${activeTrackIndex + 1} of ${tracks.length}` : `مقطع ${activeTrackIndex + 1} من ${tracks.length}`}
              </div>

              {isEditingTitle ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', maxWidth: '420px', margin: '2px 0 0 0' }}>
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') handleCancelEditTitle();
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.30)',
                      color: '#ffffff',
                      fontSize: '1rem',
                      fontWeight: '700',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                    placeholder={isEn ? 'Edit title...' : 'عدل عنوان المقطع...'}
                  />
                  <button
                    onClick={handleSaveTitle}
                    className="nav-btn"
                    title={isEn ? 'Save title' : 'حفظ العنوان'}
                    style={{ width: '32px', height: '32px', backgroundColor: 'var(--status-on-time-bg)', color: 'var(--status-on-time)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={handleCancelEditTitle}
                    className="nav-btn"
                    title={isEn ? 'Cancel' : 'إلغاء'}
                    style={{ width: '32px', height: '32px', color: 'var(--text-muted)' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    maxWidth: '100%',
                  }}
                >
                  <h2
                    onClick={handleStartEditTitle}
                    title={isEn ? 'Click to edit title' : 'انقر لتعديل العنوان'}
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      color: '#ffffff',
                      margin: 0,
                      lineHeight: 1.3,
                      maxHeight: '2.6em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      cursor: 'pointer',
                    }}
                  >
                    {activeTrack?.title || (isEn ? 'Select a track' : 'اختر مقطعاً للتشغيل')}
                  </h2>
                  {activeTrack && (
                    <button
                      onClick={handleStartEditTitle}
                      className="nav-btn"
                      title={isEn ? 'Edit title' : 'تعديل العنوان'}
                      style={{
                        width: '26px',
                        height: '26px',
                        padding: '3px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        opacity: 0.7,
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Interactive Progress Bar & Time */}
            <div style={{ width: '100%', margin: '14px 0 6px 0', direction: 'ltr' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  if (duration > 0 && audioRef.current) {
                    const newTime = ratio * duration;
                    audioRef.current.currentTime = newTime;
                    setCurrentTime(newTime);
                  }
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${progressPercent}%`,
                    backgroundColor: '#ffffff',
                    borderRadius: '3px',
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  marginTop: '6px',
                  fontWeight: '600',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>{formatAudioDuration(currentTime)}</span>
                <span>{formatAudioDuration(duration)}</span>
              </div>
            </div>

            {/* Main Playback Control Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                margin: '6px 0',
              }}
            >
              {/* Repeat Mode Toggle (Rightmost in RTL) */}
              <button
                onClick={handleCycleRepeatMode}
                className="nav-btn"
                title={
                  repeatMode === 'all'
                    ? isEn ? 'Repeat All' : 'تكرار الكل'
                    : repeatMode === 'one'
                    ? isEn ? 'Repeat Current' : 'تكرار المقطع الحالي'
                    : isEn ? 'Repeat Off' : 'إيقاف التكرار'
                }
                style={{
                  color: repeatMode !== 'off' ? 'var(--accent)' : 'var(--text-muted)',
                  backgroundColor: repeatMode !== 'off' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                }}
              >
                {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>

              {/* Next Track (Right in RTL) */}
              <button
                onClick={handleNextTrack}
                className="nav-btn"
                title={isEn ? 'Next track' : 'المقطع التالي'}
                style={{ width: '40px', height: '40px' }}
              >
                <SkipForward size={20} />
              </button>

              {/* Forward 10s (Right in RTL) */}
              <button
                onClick={() => handleSeekOffset(10)}
                className="nav-btn"
                title={isEn ? 'Forward 10s' : 'تقديم 10 ثوانٍ'}
                style={{
                  width: '38px',
                  height: '38px',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCw size={20} />
                <span
                  style={{
                    position: 'absolute',
                    fontSize: '0.52rem',
                    fontWeight: '900',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -46%)',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}
                >
                  10
                </span>
              </button>

              {/* Center Play / Pause Button */}
              <button
                onClick={handleTogglePlay}
                title={isPlaying ? (isEn ? 'Pause' : 'إيقاف مؤقت') : isEn ? 'Play' : 'تشغيل'}
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(255, 255, 255, 0.35)',
                  transform: 'scale(1)',
                  transition: 'transform 0.12s ease',
                }}
              >
                {isPlaying ? <Pause size={24} fill="#000000" /> : <Play size={24} fill="#000000" style={{ transform: 'translateX(2px)' }} />}
              </button>

              {/* Rewind 10s (Left in RTL) */}
              <button
                onClick={() => handleSeekOffset(-10)}
                className="nav-btn"
                title={isEn ? 'Rewind 10s' : 'ترجيع 10 ثوانٍ'}
                style={{
                  width: '38px',
                  height: '38px',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCcw size={20} />
                <span
                  style={{
                    position: 'absolute',
                    fontSize: '0.52rem',
                    fontWeight: '900',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -46%)',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}
                >
                  10
                </span>
              </button>

              {/* Prev Track (Left in RTL) */}
              <button
                onClick={handlePrevTrack}
                className="nav-btn"
                title={isEn ? 'Previous track' : 'المقطع السابق'}
                style={{ width: '40px', height: '40px' }}
              >
                <SkipBack size={20} />
              </button>

              {/* Shuffle Toggle (Leftmost in RTL) */}
              <button
                onClick={handleToggleShuffle}
                className="nav-btn"
                title={isEn ? 'Shuffle' : 'تشغيل عشوائي'}
                style={{
                  color: isShuffle ? 'var(--accent)' : 'var(--text-muted)',
                  backgroundColor: isShuffle ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                }}
              >
                <Shuffle size={18} />
              </button>
            </div>
          </div>

          {/* B. Playlist Sidebar (Right) */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.30)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              padding: isPlaylistExpanded ? '16px' : '14px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: isPlaylistExpanded ? '12px' : '8px',
              minHeight: 0,
              overflow: 'hidden',
              transition: 'padding 0.2s ease',
            }}
          >
            {isPlaylistExpanded ? (
              <>
                {/* Playlist Header & Search */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleTogglePlaylist}
                        className="nav-btn"
                        title={isEn ? 'Collapse playlist' : 'طي قائمة المقاطع'}
                        style={{ width: '32px', height: '32px' }}
                      >
                        {isEn ? <PanelLeftClose size={18} /> : <PanelRightClose size={18} />}
                      </button>
                      <ListMusic size={18} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontSize: '0.92rem', fontWeight: '800', color: '#ffffff' }}>
                        {isEn ? 'Playlist' : 'قائمة المقاطع'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        ({filteredTracks.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        className="nav-btn"
                        title={isEn ? 'Add audio files' : 'إضافة ملفات صوتية'}
                        style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
                      >
                        <Upload size={14} />
                      </button>
                      {tracks.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearLibrary}
                          className="nav-btn"
                          title={isEn ? 'Clear library' : 'تفريغ المكتبة'}
                          style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        [isEn ? 'left' : 'right']: '10px',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isEn ? 'Search tracks...' : 'بحث في المقاطع...'}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        [isEn ? 'paddingLeft' : 'paddingRight']: '32px',
                        fontSize: '0.82rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-pill)',
                        color: '#ffffff',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Scrollable Track List */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    paddingRight: '4px',
                  }}
                >
                  {filteredTracks.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '30px 10px',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {searchQuery ? (isEn ? 'No tracks matching search' : 'لا توجد مقاطع مطابقة للبحث') : (isEn ? 'Playlist is empty' : 'القائمة فارغة')}
                    </div>
                  ) : (
                    filteredTracks.map((track, idx) => {
                      const isCurrent = track.id === activeTrackId;
                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            setActiveTrackId(track.id);
                            setIsPlaying(true);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-lg)',
                            backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                            border: isCurrent ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                color: isCurrent ? '#ffffff' : 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            >
                              {isCurrent && isPlaying ? (
                                <Play size={10} fill="#ffffff" />
                              ) : (
                                idx + 1
                              )}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '0.84rem',
                                  fontWeight: isCurrent ? '800' : '600',
                                  color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {track.title}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {formatFileSize(track.size)}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleDeleteTrack(e, track.id)}
                            className="nav-btn"
                            title={isEn ? 'Remove from library' : 'حذف من المكتبة'}
                            style={{
                              padding: '4px',
                              width: '24px',
                              height: '24px',
                              opacity: 0.6,
                              color: 'var(--text-muted)',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* Collapsed Mode */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  height: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={handleTogglePlaylist}
                  className="nav-btn"
                  title={isEn ? 'Expand playlist' : 'توسيع قائمة المقاطع'}
                  style={{ width: '38px', height: '38px' }}
                >
                  {isEn ? <PanelLeftOpen size={18} /> : <PanelRightOpen size={18} />}
                </button>

                <div
                  onClick={handleTogglePlaylist}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    width: '100%',
                  }}
                  title={isEn ? 'Click to expand playlist' : 'انقر لتوسيع قائمة المقاطع'}
                >
                  <ListMusic size={18} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ffffff' }}>
                    {tracks.length}
                  </span>
                </div>

                {/* Mini Quick Selector */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    width: '100%',
                    alignItems: 'center',
                    padding: '4px 0',
                  }}
                >
                  {tracks.map((track, idx) => {
                    const isCurrent = track.id === activeTrackId;
                    return (
                      <button
                        key={track.id}
                        onClick={() => {
                          setActiveTrackId(track.id);
                          setIsPlaying(true);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: isCurrent ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)',
                          color: isCurrent ? '#000000' : '#ffffff',
                          border: isCurrent ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.1)',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                        title={track.title || track.name}
                      >
                        {isCurrent && isPlaying ? <Play size={10} fill="#000000" /> : idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
