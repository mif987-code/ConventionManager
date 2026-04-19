/**
 * Expo Scanner Screen
 * Uses expo-camera + @react-native-ml-kit/text-recognition for on-device OCR.
 * Replaces Tesseract.js (web) with ML Kit for ~10x faster name extraction.
 */
import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { CardEntry, ScryfallCard } from '@mtg-scanner/core';
import { getCardByName, getTcgPrice, getCardImageUrl } from '@mtg-scanner/core';

interface Props {
  onCardFound: (entry: CardEntry) => void;
}

export function ScannerScreen({ onCardFound }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [lastCard, setLastCard] = useState<ScryfallCard | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const handleScan = useCallback(async () => {
    if (!cameraRef.current || scanning) return;
    setScanning(true);
    setStatus('Capturing frame...');

    try {
      // 1. Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: true,
      });
      if (!photo) throw new Error('No photo captured');

      // 2. ML Kit OCR — extract text from full image
      setStatus('Reading card name...');
      const result = await TextRecognition.recognize(photo.uri);

      // 3. First text block is usually the card name (top of card)
      const firstLine = result.blocks?.[0]?.lines?.[0]?.text?.trim() ?? '';
      if (!firstLine || firstLine.length < 2) {
        setStatus('Could not read card name. Try again.');
        setScanning(false);
        return;
      }

      setStatus(`Looking up: "${firstLine}"...`);

      // 4. Scryfall match
      const card = await getCardByName(firstLine);
      if (!card) {
        setStatus(`No match for "${firstLine}". Confirm manually.`);
        // Still add as unconfirmed entry
        const entry: CardEntry = {
          id: Math.random().toString(36).slice(2),
          name: firstLine,
          setCode: '', setName: '', collectorNumber: '',
          finish: 'nonfoil', condition: 'NM', language: 'EN',
          quantity: 1, tcgPrice: null, scryfallId: null,
          needsConfirmation: true, source: 'scan',
        };
        onCardFound(entry);
        setScanning(false);
        return;
      }

      const price = getTcgPrice(card, 'nonfoil');
      const entry: CardEntry = {
        id: Math.random().toString(36).slice(2),
        name: card.name,
        setCode: card.set, setName: card.set_name, collectorNumber: card.collector_number,
        finish: 'nonfoil', condition: 'NM', language: 'EN',
        quantity: 1, tcgPrice: price, scryfallId: card.id,
        imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
        needsConfirmation: false, source: 'scan',
      };

      setLastCard(card);
      setStatus(`✓ ${card.name}`);
      onCardFound(entry);
    } catch (err) {
      setStatus('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setScanning(false);
    }
  }, [scanning, onCardFound]);

  if (!permission) return <View style={s.center}><ActivityIndicator /></View>;
  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.text}>Camera access required</Text>
        <TouchableOpacity onPress={requestPermission} style={s.btn}>
          <Text style={s.btnText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <CameraView ref={cameraRef} style={s.camera} facing="back">
        {/* Card guide overlay */}
        <View style={s.overlay}>
          <View style={s.guide} />
        </View>
      </CameraView>

      {/* Status bar */}
      {status ? (
        <View style={s.statusBar}>
          <Text style={s.statusText}>{status}</Text>
        </View>
      ) : null}

      {/* Last scanned card */}
      {lastCard && (
        <View style={s.lastCard}>
          <Text style={s.lastCardName}>{lastCard.name}</Text>
          <Text style={s.lastCardSub}>{lastCard.set_name} · #{lastCard.collector_number}</Text>
        </View>
      )}

      {/* Scan button */}
      <View style={s.controls}>
        <TouchableOpacity
          onPress={handleScan}
          disabled={scanning}
          style={[s.scanBtn, scanning && s.scanBtnDisabled]}
        >
          {scanning
            ? <ActivityIndicator color="white" />
            : <Text style={s.scanBtnText}>Scan card</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f13' },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f13' },
  text: { color: '#e8e6f0', marginBottom: 16, fontSize: 16 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guide: {
    width: '60%', aspectRatio: 5 / 7,
    borderWidth: 2, borderColor: '#a78bfa', borderRadius: 8,
  },
  statusBar: {
    backgroundColor: 'rgba(0,0,0,0.75)', padding: 12,
    marginHorizontal: 16, marginBottom: 4, borderRadius: 8,
  },
  statusText: { color: '#e8e6f0', fontSize: 13, textAlign: 'center' },
  lastCard: { padding: 12, paddingHorizontal: 16 },
  lastCardName: { color: '#e8e6f0', fontWeight: '700', fontSize: 15 },
  lastCardSub: { color: '#7c7c9e', fontSize: 12, marginTop: 2 },
  controls: { padding: 16, paddingBottom: 32 },
  scanBtn: {
    backgroundColor: '#a78bfa', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  scanBtnDisabled: { opacity: 0.5 },
  scanBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  btn: { backgroundColor: '#a78bfa', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: 'white', fontWeight: '600' },
});
