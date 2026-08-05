'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AudioVisualizer from '@/components/AudioVisualizer';
import {
  Mic, MicOff, Save, Trash2, Edit3, Check, X,
  RefreshCw, Database, Clock, Loader2, Volume2
} from 'lucide-react';

export default function Home() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingEditId, setSavingEditId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    fetchTranscriptions();
    initializeSpeechEngine();
  }, []);

  const fetchTranscriptions = async () => {
    try {
      const res = await axios.get('/api/transcriptions');
      setTranscriptions(res.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      showStatus('Database connection issue. Check .env credentials.', 'error');
    }
  };

  const initializeSpeechEngine = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = selectedLang;

      rec.onresult = (event) => {
        let finalStr = '';
        let interimStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript + ' ';
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }

        if (finalStr) {
          setInputText((prev) => prev + finalStr);
          setInterimText('');
        } else {
          setInterimStr(interimStr);
        }
      };

      recognitionRef.current = rec;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioBlob(audioBlob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = selectedLang;
          recognitionRef.current.start();
        } catch (e) { }
      }

      showStatus('Recording active... Speak now!', 'success');
    } catch (err) {
      console.error('Microphone error:', err);
      showStatus('Microphone access denied. Check browser permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setInterimText('');

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { }
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const processAudioBlob = async (audioBlob) => {
    setIsTranscribing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result.split(',')[1];

          const response = await axios.post('/api/transcribe', {
            audioBase64: base64Audio,
            mimeType: 'audio/webm',
            language: selectedLang,
          });

          if (response.data.text && response.data.text.length > 2) {
            setInputText(response.data.text);
            showStatus('Speech transcribed successfully!', 'success');
          }
        } catch (err) {
          console.warn('Transcription notice:', err);
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err) {
      setIsTranscribing(false);
    }
  };

  const handleSave = async () => {
    const textToSave = (inputText + (interimText ? ' ' + interimText : '')).trim();
    if (!textToSave) {
      showStatus('Cannot save empty transcription.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await axios.post('/api/transcriptions', {
        text: textToSave,
        language: selectedLang,
      });

      setTranscriptions([res.data, ...transcriptions]);
      setInputText('');
      setInterimText('');
      showStatus('Saved to Database successfully!', 'success');
    } catch (err) {
      console.error('Save Error:', err);
      showStatus('Failed to save transcription.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = async (id) => {
    if (!editText.trim()) return;

    setSavingEditId(id);
    try {
      const res = await axios.put(`/api/transcriptions/${id}`, {
        text: editText.trim(),
        language: selectedLang,
      });

      setTranscriptions(transcriptions.map((t) => (t.id === id ? res.data : t)));
      setEditingId(null);
      showStatus('Transcription updated.', 'success');
    } catch (err) {
      console.error('Update Error:', err);
      showStatus('Failed to update transcription.', 'error');
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transcription record?')) return;

    try {
      await axios.delete(`/api/transcriptions/${id}`);
      setTranscriptions(transcriptions.filter((t) => t.id !== id));
      showStatus('Deleted from Database.', 'success');
    } catch (err) {
      console.error('Delete Error:', err);
      showStatus('Failed to delete transcription.', 'error');
    }
  };

  const showStatus = (msg, type = 'info') => {
    setStatusMsg({ text: msg, type });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const displayText = inputText + (interimText ? (inputText ? ' ' : '') + interimText : '');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">

      {/* HEADER NAVBAR */}
      <header className="w-full bg-slate-900/90 border-b border-slate-800 px-6 py-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Speech to Text</h1>
              <p className="text-xs text-slate-400">Real-Time Multilingual Transcription & Database Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-semibold">{transcriptions.length} Records</span>
            </div>
          </div>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      {statusMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-semibold flex items-center gap-2 ${statusMsg.type === 'error'
            ? 'bg-red-950/90 border-red-500/40 text-red-200'
            : statusMsg.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
          }`}>
          {isTranscribing && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* CONSOLE (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-400" /> Speech Console
              </h2>

              <AudioVisualizer stream={mediaStreamRef.current} isListening={isRecording} />
            </div>

            <div className="relative">
              <textarea
                value={displayText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setInterimText('');
                }}
                placeholder={
                  isRecording
                    ? "Listening in real-time... Words will appear here as you speak..."
                    : isTranscribing
                      ? "Processing transcription..."
                      : "Click 'Start Recording' and speak in Hindi or English..."
                }
                className={`w-full min-h-[220px] bg-slate-950 border rounded-2xl p-4 text-sm leading-relaxed outline-none text-slate-100 resize-y transition ${isRecording ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800 focus:border-indigo-500'
                  }`}
              />

              {isTranscribing && (
                <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-slate-900/90 border border-indigo-500/40 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-lg animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Processing speech response...</span>
                </div>
              )}

              {interimText && !isTranscribing && (
                <div className="absolute bottom-3 left-4 text-xs font-medium text-indigo-400 animate-pulse">
                  Streaming live words...
                </div>
              )}
            </div>

            {/* CONTROLS */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isSaving}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${isTranscribing
                    ? 'bg-indigo-800 text-white cursor-wait'
                    : isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  }`}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing...</span>
                  </>
                ) : isRecording ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Recording</span>
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setInputText('');
                    setInterimText('');
                  }}
                  disabled={!displayText.trim() || isTranscribing || isSaving}
                  className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-2xl cursor-pointer"
                  title="Clear"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={handleSave}
                  disabled={!displayText.trim() || isTranscribing || isSaving}
                  className="flex items-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl text-xs font-bold cursor-pointer transition disabled:cursor-not-allowed min-w-[85px] justify-center"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* DASHBOARD HISTORY (7 COLS) */}
        <section className="lg:col-span-7 flex flex-col gap-4">

          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" /> History
            </h2>

            <button
              onClick={fetchTranscriptions}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="flex flex-col gap-3 min-h-[350px]">
            {transcriptions.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-xs font-medium">No transcriptions saved yet in the database.</p>
              </div>
            ) : (
              transcriptions.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-slate-700 transition">

                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                    <span className="flex items-center gap-1 font-mono text-indigo-400">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">
                      {item.language === 'hi-IN' ? '🇮🇳 Hinglish' : item.language}
                    </span>
                  </div>

                  {editingId === item.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-slate-950 border border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={savingEditId === item.id}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {savingEditId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={savingEditId === item.id}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs leading-relaxed text-slate-200 font-normal whitespace-pre-wrap flex-1">
                        {item.text}
                      </p>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/30 text-slate-300 hover:text-red-400 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

        </section>

      </main>

    </div>
  );
}
