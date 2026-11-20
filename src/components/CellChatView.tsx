import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AtSign,
  Camera,
  Check,
  CornerDownRight,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Link2,
  Lock,
  MessageCircle,
  Mic,
  Search,
  Send,
  Square,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { formatDatePt } from '../lib/cellAnalytics';
import { deleteCellChatMessage, sendCellChatMessage } from '../lib/cellService';
import {
  FIELD_LIMITS,
  ROLE_HIERARCHY_ORDER,
  ROLE_LABELS,
  type CellMember,
  type CellMessage,
  type CellRole,
  type CellWorkspace,
  type ChatMediaType,
  type RolePermissions,
} from '../types/cell';
import { MemberAvatar } from './MemberAvatar';

interface CellChatViewProps {
  cell: CellWorkspace;
  currentUid: string;
  currentMember: CellMember | null;
  userName: string;
  effectiveRole: CellRole;
  actualRole: CellRole;
  members: CellMember[];
  messages: CellMessage[];
  permissions: RolePermissions;
}

type PendingMedia = {
  mediaType: ChatMediaType;
  mediaName: string;
  mediaMime: string;
  mediaDataUrl?: string;
  mediaUrl?: string;
  mediaDurationSec?: number;
};

type FeedFilter = 'all' | 'mentions' | 'audio' | 'media';

const MAX_DATA_URL_LENGTH = 720000;
const MAX_RAW_MEDIA_BYTES = 510 * 1024;
const MAX_AUDIO_RECORD_SEC = 90;
const MAX_VIDEO_RECORD_SEC = 18;

function getDateIsoFromTimestamp(msg: CellMessage): string {
  try {
    const dt = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

function getTimeLabel(msg: CellMessage): string {
  try {
    const dt = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
    return dt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

function formatDuration(sec?: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

function extractYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function compressImageToDataUrl(file: File): Promise<{
  dataUrl: string;
  mime: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1080;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem neste navegador.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let quality = 0.8;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.35) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        const scale = 0.65;
        canvas.width = Math.max(1, Math.round(canvas.width * scale));
        canvas.height = Math.max(1, Math.round(canvas.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.68);
      }
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        reject(
          new Error(
            'A imagem ficou muito grande mesmo após compressão. Tente outra foto menor.',
          ),
        );
        return;
      }
      resolve({ dataUrl, mime: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar esta foto.'));
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao ler arquivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Falha ao processar mídia.'));
    reader.readAsDataURL(blob);
  });
}

function pickSupportedMime(candidates: string[]): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

export function CellChatView({
  cell,
  currentUid,
  currentMember,
  userName,
  effectiveRole,
  actualRole,
  members,
  messages,
  permissions,
}: CellChatViewProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    preview: string;
  } | null>(null);

  // Pull / Mention Members state
  const [selectedMentions, setSelectedMentions] = useState<CellMember[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  // Directory side drawer + batch selection
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [directorySelectedIds, setDirectorySelectedIds] = useState<string[]>([]);

  // Media attachment state
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    name: string;
  } | null>(null);

  // Voice recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<number | null>(null);
  const audioCancelFlagRef = useRef(false);
  const audioSendDirectFlagRef = useRef(false);

  // Short Video modal / link state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalTab, setVideoModalTab] = useState<'record' | 'link'>('record');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<number | null>(null);
  const videoCancelFlagRef = useRef(false);

  // File inputs & scroll refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const canSendMessage = Boolean(currentMember || actualRole === 'lider');

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aMs = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : Number.MAX_SAFE_INTEGER;
      const bMs = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : Number.MAX_SAFE_INTEGER;
      if (aMs !== bMs) return aMs - bMs;
      return a.id.localeCompare(b.id);
    });
  }, [messages]);

  const mentionHitsCount = useMemo(() => {
    if (!currentMember) return 0;
    return messages.filter((m) =>
      m.mentionedMemberIds?.includes(currentMember.id),
    ).length;
  }, [messages, currentMember]);

  const visibleMessages = useMemo(() => {
    if (feedFilter === 'all') return sortedMessages;
    if (feedFilter === 'mentions') {
      if (!currentMember) return [];
      return sortedMessages.filter((m) =>
        m.mentionedMemberIds?.includes(currentMember.id),
      );
    }
    if (feedFilter === 'audio') {
      return sortedMessages.filter((m) => m.mediaType === 'audio');
    }
    return sortedMessages.filter(
      (m) => m.mediaType === 'image' || m.mediaType === 'video',
    );
  }, [sortedMessages, feedFilter, currentMember]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const oA = ROLE_HIERARCHY_ORDER[a.role] ?? 99;
        const oB = ROLE_HIERARCHY_ORDER[b.role] ?? 99;
        if (oA !== oB) return oA - oB;
        return a.fullName.localeCompare(b.fullName);
      }),
    [members],
  );

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const filteredMentionMembers = useMemo(() => {
    const q = mentionSearch.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        ROLE_LABELS[m.role].toLowerCase().includes(q) ||
        (m.wing || 'Masculina').toLowerCase().includes(q),
    );
  }, [sortedMembers, mentionSearch]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visibleMessages.length, feedFilter]);

  // Cleanup active streams/timers on unmount
  useEffect(() => {
    return () => {
      if (audioTimerRef.current) window.clearInterval(audioTimerRef.current);
      if (videoTimerRef.current) window.clearInterval(videoTimerRef.current);
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMentionMember = (m: CellMember) => {
    setSelectedMentions((prev) =>
      prev.some((x) => x.id === m.id)
        ? prev.filter((x) => x.id !== m.id)
        : [...prev, m],
    );
  };

  const pullGroupToComposer = (group: CellMember[]) => {
    if (group.length === 0) return;
    setSelectedMentions((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of group) {
        if (m.id !== currentMember?.id) {
          byId.set(m.id, m);
        }
      }
      return Array.from(byId.values());
    });
    setMentionPickerOpen(false);
    composerRef.current?.focus();
  };

  const sendMessageNow = async (
    overrideMedia?: PendingMedia | null,
    overrideText?: string,
  ) => {
    if (sending || !canSendMessage) return;
    const mediaToSend = overrideMedia !== undefined ? overrideMedia : pendingMedia;
    const textToSend = (overrideText !== undefined ? overrideText : text).trim();
    if (!textToSend && !mediaToSend) return;

    setSending(true);
    setError(null);
    try {
      await sendCellChatMessage({
        cell,
        senderUid: currentUid,
        senderMemberId: currentMember?.id || '',
        senderName: currentMember?.fullName || userName,
        senderRole: currentMember?.role || effectiveRole,
        senderWing: currentMember?.wing || 'Masculina',
        text: textToSend,
        media: mediaToSend
          ? {
              mediaType: mediaToSend.mediaType,
              mediaName: mediaToSend.mediaName,
              mediaMime: mediaToSend.mediaMime,
              mediaDataUrl: mediaToSend.mediaDataUrl,
              mediaUrl: mediaToSend.mediaUrl,
              mediaDurationSec: mediaToSend.mediaDurationSec,
            }
          : null,
        mentions:
          selectedMentions.length > 0
            ? {
                memberIds: selectedMentions.map((m) => m.id),
                names: selectedMentions.map((m) => m.fullName),
              }
            : null,
        replyTo,
      });
      if (overrideText === undefined) setText('');
      if (overrideMedia === undefined) setPendingMedia(null);
      setSelectedMentions([]);
      setReplyTo(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar a mensagem.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessageNow();
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (val.endsWith('@')) {
      setMentionSearch('');
      setMentionPickerOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // PHOTO HANDLER
  const handleSelectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file);
      setPendingMedia({
        mediaType: 'image',
        mediaName: file.name.slice(0, 160),
        mediaMime: compressed.mime,
        mediaDataUrl: compressed.dataUrl,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao preparar a foto.',
      );
    }
  };

  // AUDIO FILE HANDLER
  const handleSelectAudioFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (file.size > MAX_RAW_MEDIA_BYTES) {
      setError(
        `O áudio "${file.name}" tem ${(file.size / 1024).toFixed(0)} KB. Envie arquivos de até 510 KB ou grave direto pelo microfone.`,
      );
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        setError('Arquivo de áudio excedeu o limite permitido.');
        return;
      }
      setPendingMedia({
        mediaType: 'audio',
        mediaName: file.name.slice(0, 160),
        mediaMime: (file.type || 'audio/mpeg').slice(0, 120),
        mediaDataUrl: dataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler áudio.');
    }
  };

  // AUDIO RECORDER
  const startAudioRecording = async () => {
    if (isRecordingAudio || !canSendMessage) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(
        'Gravação de áudio não suportada neste navegador. Você pode anexar um arquivo de áudio.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mimeType = pickSupportedMime([
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      audioCancelFlagRef.current = false;
      audioSendDirectFlagRef.current = false;
      let recordedSecs = 0;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (audioTimerRef.current) {
          window.clearInterval(audioTimerRef.current);
          audioTimerRef.current = null;
        }
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        setIsRecordingAudio(false);

        if (audioCancelFlagRef.current) {
          audioChunksRef.current = [];
          return;
        }
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        audioChunksRef.current = [];

        if (blob.size < 200) return;
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          setError(
            'A gravação ficou acima do tamanho máximo permitido. Grave mensagens de áudio um pouco mais curtas.',
          );
          return;
        }
        const audioMedia: PendingMedia = {
          mediaType: 'audio',
          mediaName: `audio-${formatDuration(recordedSecs)}.webm`,
          mediaMime: finalMime.slice(0, 120),
          mediaDataUrl: dataUrl,
          mediaDurationSec: Math.max(1, recordedSecs),
        };
        if (audioSendDirectFlagRef.current) {
          await sendMessageNow(audioMedia, text);
          setText('');
        } else {
          setPendingMedia(audioMedia);
        }
      };

      audioRecorderRef.current = recorder;
      recorder.start(250);
      setAudioSeconds(0);
      setIsRecordingAudio(true);

      audioTimerRef.current = window.setInterval(() => {
        recordedSecs += 1;
        setAudioSeconds(recordedSecs);
        if (recordedSecs >= MAX_AUDIO_RECORD_SEC) {
          audioSendDirectFlagRef.current = false;
          recorder.stop();
        }
      }, 1000);
    } catch {
      setError(
        'Não foi possível acessar o microfone. Verifique a permissão de áudio do navegador.',
      );
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
  };

  const stopAudioRecording = (action: 'send' | 'attach' | 'cancel') => {
    const rec = audioRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    audioCancelFlagRef.current = action === 'cancel';
    audioSendDirectFlagRef.current = action === 'send';
    rec.stop();
  };

  // VIDEO FILE HANDLER
  const handleSelectVideoFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (file.size > MAX_RAW_MEDIA_BYTES) {
      setError(
        `O vídeo "${file.name}" tem ${(file.size / 1024).toFixed(0)} KB. Para enviar direto no chat use um clipe até 510 KB, grave pelo botão "Gravar Vídeo Curto" ou cole o link do vídeo.`,
      );
      setVideoModalTab('link');
      setVideoModalOpen(true);
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        setError('O vídeo excedeu o limite. Use "Gravar Vídeo Curto" ou cole um link.');
        return;
      }
      setPendingMedia({
        mediaType: 'video',
        mediaName: file.name.slice(0, 160),
        mediaMime: (file.type || 'video/mp4').slice(0, 120),
        mediaDataUrl: dataUrl,
      });
      setVideoModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler vídeo.');
    }
  };

  // SHORT VIDEO RECORDER
  const openVideoModal = () => {
    setError(null);
    setVideoLinkInput('');
    setVideoModalTab('record');
    setVideoModalOpen(true);
  };

  const closeVideoModal = () => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoCancelFlagRef.current = true;
      videoRecorderRef.current.stop();
    }
    if (videoTimerRef.current) {
      window.clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    setIsRecordingVideo(false);
    setVideoModalOpen(false);
  };

  const startShortVideoRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Gravação de vídeo não suportada neste navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
        audio: true,
      });
      videoStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => undefined);
      }

      const mimeType = pickSupportedMime([
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ]);
      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 180000,
            audioBitsPerSecond: 24000,
          })
        : new MediaRecorder(stream);

      videoChunksRef.current = [];
      videoCancelFlagRef.current = false;
      let recordedSecs = 0;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          videoChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (videoTimerRef.current) {
          window.clearInterval(videoTimerRef.current);
          videoTimerRef.current = null;
        }
        videoStreamRef.current?.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
        setIsRecordingVideo(false);

        if (videoCancelFlagRef.current) {
          videoChunksRef.current = [];
          return;
        }
        const finalMime = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(videoChunksRef.current, { type: finalMime });
        videoChunksRef.current = [];

        if (blob.size < 400) return;
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          setError(
            'O vídeo gravado ultrapassou o tamanho máximo. Tente gravar um clipe de até 12 segundos.',
          );
          return;
        }
        setPendingMedia({
          mediaType: 'video',
          mediaName: `video-${formatDuration(recordedSecs)}.webm`,
          mediaMime: finalMime.slice(0, 120),
          mediaDataUrl: dataUrl,
          mediaDurationSec: Math.max(1, recordedSecs),
        });
        setVideoModalOpen(false);
      };

      videoRecorderRef.current = recorder;
      recorder.start(250);
      setVideoSeconds(0);
      setIsRecordingVideo(true);

      videoTimerRef.current = window.setInterval(() => {
        recordedSecs += 1;
        setVideoSeconds(recordedSecs);
        if (recordedSecs >= MAX_VIDEO_RECORD_SEC) {
          recorder.stop();
        }
      }, 1000);
    } catch {
      setError(
        'Não foi possível acessar câmera/microfone. Verifique as permissões ou envie um arquivo/link de vídeo.',
      );
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
  };

  const stopShortVideoRecording = (cancel: boolean) => {
    const rec = videoRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    videoCancelFlagRef.current = cancel;
    rec.stop();
  };

  const attachVideoLink = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = videoLinkInput.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) {
      setError('Informe um link válido começando com http:// ou https://');
      return;
    }
    setPendingMedia({
      mediaType: 'video',
      mediaName: 'Vídeo externo',
      mediaMime: 'text/uri-list',
      mediaUrl: raw.slice(0, FIELD_LIMITS.resourceUrl),
    });
    setVideoModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Bate-Papo da Célula
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Converse por texto, áudio, fotos e vídeos ou puxe membros registrados da {cell.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMembersPanel((prev) => !prev)}
          className={`w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            showMembersPanel
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Selecionar / Puxar Membros ({members.length})</span>
        </button>
      </div>

      {/* Feed Quick Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'all', label: `Todas (${messages.length})` },
            {
              id: 'mentions',
              label:
                mentionHitsCount > 0
                  ? `Me mencionaram (${mentionHitsCount})`
                  : 'Me mencionaram',
            },
            { id: 'audio', label: 'Áudios' },
            { id: 'media', label: 'Fotos e Vídeos' },
          ] as Array<{ id: FeedFilter; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFeedFilter(tab.id)}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              feedFilter === tab.id
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chat Workspace Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div
          className={`${
            showMembersPanel ? 'lg:col-span-8' : 'lg:col-span-12'
          } bg-white border border-slate-200 rounded-xl flex flex-col h-[calc(100vh-17.5rem)] sm:h-[calc(100vh-15.5rem)] min-h-[430px] overflow-hidden relative`}
        >
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 bg-slate-50/50">
            {visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
                <MessageCircle className="w-9 h-9 text-slate-300 mb-2.5" />
                <p className="text-sm font-semibold text-slate-900">
                  {feedFilter === 'all'
                    ? 'Nenhuma mensagem enviada ainda'
                    : 'Nenhuma mensagem neste filtro'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Envie mensagens de texto, grave áudios de voz, compartilhe fotos ou vídeos e mencione membros com @.
                </p>
              </div>
            ) : (
              visibleMessages.map((msg, idx) => {
                const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
                const dateIso = getDateIsoFromTimestamp(msg);
                const prevDateIso = prevMsg
                  ? getDateIsoFromTimestamp(prevMsg)
                  : '';
                const showDateDivider = dateIso && dateIso !== prevDateIso;

                const isOwn = currentMember
                  ? msg.senderMemberId === currentMember.id ||
                    (msg.senderUid === currentUid && !msg.senderMemberId)
                  : msg.senderUid === currentUid;

                const isMentionedSelf =
                  currentMember &&
                  msg.mentionedMemberIds?.includes(currentMember.id);

                const canDelete =
                  isOwn || permissions.canManageRolesAndTrainers;

                const youtubeEmbed = msg.mediaUrl
                  ? extractYouTubeEmbedUrl(msg.mediaUrl)
                  : null;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="flex items-center justify-center py-2">
                        <span className="px-3 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md tabular-nums">
                          {formatDatePt(dateIso)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isOwn ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[90%] sm:max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm shadow-2xs ${
                          isOwn
                            ? 'bg-teal-700 text-white'
                            : isMentionedSelf
                              ? 'bg-amber-50 border-2 border-amber-300 text-slate-900'
                              : 'bg-white border border-slate-200 text-slate-900'
                        }`}
                      >
                        {/* Sender header */}
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MemberAvatar
                              name={msg.senderName}
                              photoDataUrl={
                                msg.senderMemberId
                                  ? memberById.get(msg.senderMemberId)?.photoDataUrl
                                  : undefined
                              }
                              size="xs"
                            />
                            <span
                              className={`text-xs font-bold truncate ${
                                isOwn ? 'text-teal-50' : 'text-slate-900'
                              }`}
                            >
                              {msg.senderName}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                isOwn
                                  ? 'bg-teal-800/80 text-teal-100'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ROLE_LABELS[msg.senderRole] || 'Membro'}
                            </span>
                            {isMentionedSelf && !isOwn && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                Puxou você
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono tabular-nums shrink-0 ${
                              isOwn ? 'text-teal-100/90' : 'text-slate-400'
                            }`}
                          >
                            {getTimeLabel(msg)}
                          </span>
                        </div>

                        {/* Quoted Reply */}
                        {msg.replyToName && msg.replyToPreview && (
                          <div
                            className={`mb-2 px-2.5 py-1.5 rounded-lg text-xs border-l-2 ${
                              isOwn
                                ? 'bg-teal-800/60 border-teal-300 text-teal-50'
                                : 'bg-slate-50 border-teal-600 text-slate-600'
                            }`}
                          >
                            <div className="font-semibold text-[11px]">
                              {msg.replyToName}
                            </div>
                            <div className="truncate opacity-90">
                              {msg.replyToPreview}
                            </div>
                          </div>
                        )}

                        {/* Mentioned / Pulled Members Chips */}
                        {msg.mentionedNames && msg.mentionedNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {msg.mentionedNames.map((mName, i) => (
                              <span
                                key={`${msg.id}_m_${i}`}
                                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  isOwn
                                    ? 'bg-teal-800 text-teal-100'
                                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                                }`}
                              >
                                @{mName}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Media Content: IMAGE */}
                        {msg.mediaType === 'image' && msg.mediaDataUrl && (
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  src: msg.mediaDataUrl!,
                                  name: msg.mediaName || 'Foto da célula',
                                })
                              }
                              className="block rounded-lg overflow-hidden border border-black/10 cursor-pointer"
                            >
                              <img
                                src={msg.mediaDataUrl}
                                alt={msg.mediaName || 'Foto compartilhada'}
                                className="max-h-64 w-auto object-cover"
                              />
                            </button>
                          </div>
                        )}

                        {/* Media Content: AUDIO */}
                        {msg.mediaType === 'audio' && msg.mediaDataUrl && (
                          <div
                            className={`mb-2 rounded-lg p-2 ${
                              isOwn
                                ? 'bg-teal-800/70'
                                : 'bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1 text-[11px]">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  isOwn ? 'text-teal-100' : 'text-slate-700'
                                }`}
                              >
                                <Mic className="w-3.5 h-3.5" />
                                Mensagem de áudio
                              </span>
                              {typeof msg.mediaDurationSec === 'number' &&
                                msg.mediaDurationSec > 0 && (
                                  <span
                                    className={`font-mono tabular-nums ${
                                      isOwn ? 'text-teal-100' : 'text-slate-500'
                                    }`}
                                  >
                                    {formatDuration(msg.mediaDurationSec)}
                                  </span>
                                )}
                            </div>
                            <audio
                              controls
                              preload="metadata"
                              src={msg.mediaDataUrl}
                              className="w-full max-w-[260px] sm:max-w-[300px] h-9"
                            />
                          </div>
                        )}

                        {/* Media Content: VIDEO (inline dataUrl or external link/embed) */}
                        {msg.mediaType === 'video' && (
                          <div className="mb-2 space-y-1.5">
                            {msg.mediaDataUrl ? (
                              <video
                                controls
                                playsInline
                                preload="metadata"
                                src={msg.mediaDataUrl}
                                className="w-full max-w-[320px] max-h-64 rounded-lg bg-black"
                              />
                            ) : youtubeEmbed ? (
                              <div className="w-full max-w-[320px] aspect-video rounded-lg overflow-hidden bg-black">
                                <iframe
                                  src={youtubeEmbed}
                                  title={msg.mediaName || 'Vídeo compartilhado'}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              </div>
                            ) : msg.mediaUrl ? (
                              <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                                  isOwn
                                    ? 'bg-teal-800 text-white hover:bg-teal-900'
                                    : 'bg-slate-100 text-teal-800 hover:bg-slate-200'
                                }`}
                              >
                                <Film className="w-4 h-4 shrink-0" />
                                <span>Abrir vídeo compartilhado</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            ) : null}
                          </div>
                        )}

                        {/* Text Caption / Message */}
                        {msg.text && (
                          <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        )}

                        {/* Message actions */}
                        <div
                          className={`mt-1.5 flex items-center justify-end gap-2.5 text-[11px] ${
                            isOwn ? 'text-teal-100' : 'text-slate-400'
                          }`}
                        >
                          {canSendMessage && (
                            <button
                              type="button"
                              onClick={() => {
                                const preview =
                                  msg.text ||
                                  (msg.mediaType === 'audio'
                                    ? 'Mensagem de áudio'
                                    : msg.mediaType === 'image'
                                      ? 'Foto'
                                      : 'Vídeo');
                                setReplyTo({
                                  id: msg.id,
                                  senderName: msg.senderName,
                                  preview: preview.slice(0, 120),
                                });
                              }}
                              className={`inline-flex items-center gap-1 hover:underline cursor-pointer ${
                                isOwn
                                  ? 'text-teal-100 hover:text-white'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <CornerDownRight className="w-3 h-3" />
                              Responder
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => deleteCellChatMessage(msg.id)}
                              title="Excluir mensagem"
                              className={`inline-flex items-center gap-1 cursor-pointer ${
                                isOwn
                                  ? 'text-teal-100 hover:text-white'
                                  : 'text-slate-400 hover:text-red-600'
                              }`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Floating Mention / Pull Members Picker */}
          {mentionPickerOpen && (
            <div className="border-t border-slate-200 bg-white p-3 space-y-2.5 max-h-64 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-teal-700" />
                  Selecionar / Puxar Membros Registrados
                </div>
                <button
                  type="button"
                  onClick={() => setMentionPickerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={mentionSearch}
                    onChange={(e) => setMentionSearch(e.target.value)}
                    placeholder="Buscar membro por nome, cargo ou ala..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    pullGroupToComposer(
                      members.filter((m) => (m.wing || 'Masculina') === 'Masculina'),
                    )
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  + Ala Masculina
                </button>
                <button
                  type="button"
                  onClick={() =>
                    pullGroupToComposer(
                      members.filter((m) => m.wing === 'Feminina'),
                    )
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  + Ala Feminina
                </button>
                <button
                  type="button"
                  onClick={() => pullGroupToComposer(members)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                >
                  + Puxar Todos
                </button>
              </div>

              <div className="overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                {filteredMentionMembers.map((m) => {
                  const picked = selectedMentions.some((x) => x.id === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMentionMember(m)}
                      className={`px-2.5 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        picked
                          ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                          : 'bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar
                          name={m.fullName}
                          photoDataUrl={m.photoDataUrl}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <div className="truncate">{m.fullName}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {ROLE_LABELS[m.role]} · Ala {m.wing || 'Masculina'}
                          </div>
                        </div>
                      </div>
                      {picked && (
                        <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white p-3 sm:p-4 space-y-2">
            {error && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="p-1 text-red-500 hover:text-red-800 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Selected / Pulled Members Chips */}
            {selectedMentions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 bg-teal-50/70 border border-teal-200 rounded-lg text-xs">
                <span className="text-[11px] font-semibold text-teal-800 mr-1">
                  Puxando:
                </span>
                {selectedMentions.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-teal-200 text-teal-900 font-medium text-[11px]"
                  >
                    @{m.fullName}
                    <button
                      type="button"
                      onClick={() => toggleMentionMember(m)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label={`Remover ${m.fullName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Pending Media Preview */}
            {pendingMedia && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {pendingMedia.mediaType === 'image' && pendingMedia.mediaDataUrl ? (
                    <img
                      src={pendingMedia.mediaDataUrl}
                      alt="Prévia da foto"
                      className="w-12 h-12 rounded-md object-cover border border-slate-200 shrink-0"
                    />
                  ) : pendingMedia.mediaType === 'audio' &&
                    pendingMedia.mediaDataUrl ? (
                    <audio
                      controls
                      src={pendingMedia.mediaDataUrl}
                      className="h-8 max-w-[200px] sm:max-w-[260px]"
                    />
                  ) : (
                    <Film className="w-5 h-5 text-teal-700 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {pendingMedia.mediaName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {pendingMedia.mediaType === 'image'
                        ? 'Foto pronta para enviar'
                        : pendingMedia.mediaType === 'audio'
                          ? `Áudio pronto (${formatDuration(pendingMedia.mediaDurationSec)})`
                          : pendingMedia.mediaUrl
                            ? `Link de vídeo: ${pendingMedia.mediaUrl}`
                            : 'Vídeo pronto para enviar'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                  aria-label="Remover mídia"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Reply Preview */}
            {replyTo && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-teal-800">
                    Respondendo a {replyTo.senderName}:{' '}
                  </span>
                  <span className="text-slate-600 truncate">
                    {replyTo.preview}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                  aria-label="Cancelar resposta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {canSendMessage ? (
              isRecordingAudio ? (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                    <span>Gravando áudio...</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(audioSeconds)} / {formatDuration(MAX_AUDIO_RECORD_SEC)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stopAudioRecording('cancel')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => stopAudioRecording('attach')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg cursor-pointer"
                    >
                      Ouvir antes
                    </button>
                    <button
                      type="button"
                      onClick={() => stopAudioRecording('send')}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar Áudio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Hidden file pickers */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectPhoto}
                    className="hidden"
                  />
                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleSelectAudioFile}
                    className="hidden"
                  />
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleSelectVideoFile}
                    className="hidden"
                  />

                  {/* Media & Mention Toolbar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Mic className="w-3.5 h-3.5 text-teal-700" />
                      <span>Gravar Áudio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-teal-700" />
                      <span>Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={openVideoModal}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Video className="w-3.5 h-3.5 text-teal-700" />
                      <span>Vídeo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => audioFileInputRef.current?.click()}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Arquivo Áudio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMentionPickerOpen((prev) => !prev)}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                        mentionPickerOpen || selectedMentions.length > 0
                          ? 'bg-teal-700 text-white'
                          : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      <AtSign className="w-3.5 h-3.5" />
                      <span>Puxar Membros</span>
                    </button>
                  </div>

                  {/* Text Input + Send */}
                  <form onSubmit={handleSend} className="flex items-end gap-2">
                    <textarea
                      ref={composerRef}
                      rows={1}
                      maxLength={FIELD_LIMITS.chatMessage}
                      value={text}
                      onChange={(e) => handleTextChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Mensagem como ${currentMember?.fullName || userName} (digite @ para puxar)...`}
                      className="flex-1 min-h-[44px] max-h-28 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                    <button
                      type="submit"
                      disabled={sending || (!text.trim() && !pendingMedia)}
                      className="min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {sending ? 'Enviando...' : 'Enviar'}
                      </span>
                    </button>
                  </form>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Apenas membros com ficha cadastrada nesta célula podem conversar no bate-papo.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Registered Members Directory + Select & Pull Drawer */}
        {showMembersPanel && (
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[420px] lg:max-h-[calc(100vh-15.5rem)]">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900">
                Selecionar / Puxar Membros ({sortedMembers.length})
              </div>
              <button
                type="button"
                onClick={() => setShowMembersPanel(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                aria-label="Fechar lista de participantes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {directorySelectedIds.length > 0 && (
              <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-200 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-teal-900">
                  {directorySelectedIds.length} selecionado(s)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDirectorySelectedIds([])}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const picked = members.filter((m) =>
                        directorySelectedIds.includes(m.id),
                      );
                      pullGroupToComposer(picked);
                      setDirectorySelectedIds([]);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    Puxar no Chat
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100 overflow-y-auto">
              {sortedMembers.map((m) => {
                const isSelf = m.id === currentMember?.id;
                const isChecked = directorySelectedIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70"
                  >
                    <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                      {!isSelf && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setDirectorySelectedIds((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id],
                            )
                          }
                          className="w-4 h-4 accent-teal-700 rounded shrink-0"
                        />
                      )}
                      <MemberAvatar
                        name={m.fullName}
                        photoDataUrl={m.photoDataUrl}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {m.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {ROLE_LABELS[m.role]} · Ala {m.wing || 'Masculina'}
                        </div>
                      </div>
                    </label>

                    {isSelf ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded shrink-0">
                        Você
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pullGroupToComposer([m])}
                        className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md cursor-pointer shrink-0"
                      >
                        @ Puxar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Video Capture / Upload / Link Modal */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-md p-5 pb-safe space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                <Video className="w-4 h-4 text-teal-700" />
                Enviar Vídeo no Bate-Papo
              </h2>
              <button
                type="button"
                onClick={closeVideoModal}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setVideoModalTab('record')}
                className={`py-2 px-2 rounded-md font-semibold cursor-pointer ${
                  videoModalTab === 'record'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Gravar Curto
              </button>
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                className="py-2 px-2 rounded-md font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Arquivo (510KB)
              </button>
              <button
                type="button"
                onClick={() => setVideoModalTab('link')}
                className={`py-2 px-2 rounded-md font-semibold cursor-pointer ${
                  videoModalTab === 'link'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Colar Link
              </button>
            </div>

            {videoModalTab === 'record' ? (
              <div className="space-y-3">
                <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center relative">
                  <video
                    ref={videoPreviewRef}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isRecordingVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white/90 px-4">
                      <Camera className="w-8 h-8 mb-2 opacity-80" />
                      <p className="text-xs">
                        Grave um recado rápido de até {MAX_VIDEO_RECORD_SEC} segundos direto pela câmera.
                      </p>
                    </div>
                  )}
                  {isRecordingVideo && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-mono font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      {formatDuration(videoSeconds)} / {formatDuration(MAX_VIDEO_RECORD_SEC)}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  {isRecordingVideo ? (
                    <>
                      <button
                        type="button"
                        onClick={() => stopShortVideoRecording(true)}
                        className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => stopShortVideoRecording(false)}
                        className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Concluir Vídeo
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startShortVideoRecording}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      Iniciar Gravação de Vídeo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={attachVideoLink} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Link do Vídeo (YouTube, Google Drive, Instagram, MP4)
                  </label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      required
                      value={videoLinkInput}
                      onChange={(e) => setVideoLinkInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Anexar Link de Vídeo
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-3xl w-full flex items-center justify-between text-white mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-medium truncate">
              {lightboxImage.name}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={lightboxImage.src}
                download={lightboxImage.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 hover:bg-white/15 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <img
            src={lightboxImage.src}
            alt={lightboxImage.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
