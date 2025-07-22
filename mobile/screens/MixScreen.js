import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import axios from "axios";

export default function MixScreen({ route }) {
  const { track } = route.params;
  const [downloadStatus, setDownloadStatus] = useState("pending");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startDownload = async () => {
      setDownloadStatus("downloading");
      const res = await axios.post("http://192.168.0.242:8000/download", {
        url: track.streaming_url,
        out_name: track.title.replace(/[^a-zA-Z0-9]/g, "_")
      });
      const taskId = res.data.task_id;
      const interval = setInterval(async () => {
        const prog = await axios.get(`http://192.168.0.242:8000/progress/${taskId}`);
        if (prog.data.status === "SUCCESS") {
          setDownloadStatus("done");
          clearInterval(interval);
        }
      }, 1000);
    };
    startDownload();
  }, []);

  return (
    <View className="flex-1 bg-white justify-center items-center">
      <Text className="text-2xl font-bold mb-4">{track.title}</Text>
      {downloadStatus === "downloading" && <ActivityIndicator />}
      {downloadStatus === "done" && (
        <TouchableOpacity className="bg-yellow-400 px-8 py-4 rounded-full">
          <Text className="text-black font-bold">Start Mixing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
} 