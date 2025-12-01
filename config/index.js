
import { initializeApp } from "firebase/app";

import { initializeAuth, getReactNativePersistence } from 'firebase/auth';

import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmRc310MvHVF3uBbo9Kl6WFSW1mZsZLTM",
  authDomain: "whatsapp-ines.firebaseapp.com",
  projectId: "whatsapp-ines",
  storageBucket: "whatsapp-ines.firebasestorage.app",
  messagingSenderId: "64505272708",
  appId: "1:64505272708:web:8c667dab3034e519f1e5d1",
  measurementId: "G-LV807E44FC"
};

import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://wfjuwhsltlyrrwgnbzir.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmanV3aHNsdGx5cnJ3Z25iemlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODYxNjEsImV4cCI6MjA3OTk2MjE2MX0.NFMmj1E-FlS4qgCo96qXn28FQt47lq-1rdtMJHEQKw8"
const supabase = createClient(supabaseUrl, supabaseKey)


// Initialize Firebase
const app = initializeApp(firebaseConfig);


const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});


export { app, auth,supabase};