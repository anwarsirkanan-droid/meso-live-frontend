import axios from 'axios';
import { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Backend Render URL
const BACKEND_URL = 'https://meso-live-backend.onrender.com/api/command';

export default function App() {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const sendCommand = async () => {
    if (!command.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await axios.post(BACKEND_URL, { command });
      setResponse(res.data);
    } catch (error: any) {
      setResponse({
        success: false,
        message: 'Backend server waliin wal-qunnamuu hin dandeenye.',
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1e2e" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>🎙️ Meso ERP Voice Assistant</Text>
        <Text style={styles.subtitle}>
          Ajaja kee barreessi ykn dubbadhu (fkn: "Add 50 bags of Cement")
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ajaja ERP asitti barreessi..."
            placeholderTextColor="#a6adc8"
            value={command}
            onChangeText={setCommand}
            multiline
          />
          <TouchableOpacity
            style={styles.button}
            onPress={sendCommand}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Ergi (Send)</Text>
            )}
          </TouchableOpacity>
        </View>

        {response && (
          <View style={styles.responseCard}>
            <Text style={styles.responseTitle}>Deebii System-a:</Text>
            <Text
              style={[
                styles.statusText,
                { color: response.success ? '#a6e3a1' : '#f38ba8' },
              ]}
            >
              Status: {response.success ? 'Success ✅' : 'Failed ❌'}
            </Text>
            <Text style={styles.responseText}>
              {JSON.stringify(response, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#cdd6f4',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a6adc8',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    backgroundColor: '#313244',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#181825',
    color: '#cdd6f4',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#89b4fa',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#11111b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  responseCard: {
    backgroundColor: '#313244',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#cdd6f4',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  responseText: {
    color: '#bac2de',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});