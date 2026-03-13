import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { doc, setDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';

export function useDeviceSync() {
  const [deviceId] = useState(() => {
    const saved = localStorage.getItem('nerv_device_id');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(7);
    localStorage.setItem('nerv_device_id', newId);
    return newId;
  });

  const [devices, setDevices] = useState<any[]>([]);
  const [lastCommand, setLastCommand] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Register this device
    const deviceRef = doc(db, `users/${auth.currentUser.uid}/devices/${deviceId}`);
    setDoc(deviceRef, {
      id: deviceId,
      name: `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`,
      type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      lastActive: serverTimestamp(),
    }, { merge: true });

    // Listen for all devices
    const devicesRef = collection(db, `users/${auth.currentUser.uid}/devices`);
    const unsubDevices = onSnapshot(devicesRef, (snapshot) => {
      setDevices(snapshot.docs.map(doc => doc.data()));
    });

    // Listen for commands for THIS device
    const commandsRef = collection(db, `users/${auth.currentUser.uid}/commands`);
    const q = query(
      commandsRef,
      where('targetDeviceId', '==', deviceId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubCommands = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const cmdDoc = snapshot.docs[0];
        const cmdData = cmdDoc.data();
        setLastCommand({ ...cmdData, docId: cmdDoc.id });
        
        // Mark as executing immediately
        setDoc(cmdDoc.ref, { status: 'executing' }, { merge: true });
      }
    });

    return () => {
      unsubDevices();
      unsubCommands();
    };
  }, [deviceId, auth.currentUser]);

  const sendCommand = async (targetDeviceId: string, action: string, params: any = {}) => {
    if (!auth.currentUser) return;
    const commandsRef = collection(db, `users/${auth.currentUser.uid}/commands`);
    await addDoc(commandsRef, {
      targetDeviceId,
      sourceDeviceId: deviceId,
      action,
      params,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  };

  const completeCommand = async (commandDocId: string) => {
    if (!auth.currentUser) return;
    const cmdRef = doc(db, `users/${auth.currentUser.uid}/commands/${commandDocId}`);
    await setDoc(cmdRef, { status: 'completed' }, { merge: true });
  };

  return { deviceId, devices, lastCommand, sendCommand, completeCommand };
}
