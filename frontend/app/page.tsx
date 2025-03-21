"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Info, Github, MicOff, BarChart as LucideBarChart } from "lucide-react";
import EmotionRecorder from "@/components/emotion-recorder";
import { io, Socket } from "socket.io-client";
import EmotionVisualizer from "@/components/EmotionVisualizer";
import Footer from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

const EMOTION_COLORS: Record<string, string> = {
  happy: "#10b981",
  sad: "#6366f1",
  angry: "#ef4444",
  love: "#f59e0b",
  scared: "#8b5cf6",
  Neutral: "#64748b",
};

const getEmotionColor = (emotion: string): string => EMOTION_COLORS[emotion] || "#64748b";

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [modelResponse, setModelResponse] = useState<any>({});
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [emotionData, setEmotionData] = useState<any>(null);
  const [recordingHistory, setRecordingHistory] = useState<any[]>([]);

  // Load stored recording history from localStorage on component mount
  useEffect(() => {
    const storedHistory = localStorage.getItem("recordingHistory");
    if (storedHistory) {
      setRecordingHistory(JSON.parse(storedHistory));
    }
  }, []);

  // New state for section selection using buttons
  const [selectedSection, setSelectedSection] = useState("section1");
  const deleteHistory = ()=>{
    localStorage.removeItem("recordingHistory");
    setRecordingHistory([]);
  }
  useEffect(() => {
    const newSocket = io("https://aug-back-deploy-production.up.railway.app/");

    newSocket.on("connect", () => {
      console.log("✅ Socket.IO Connected");
    });

    newSocket.on("response", (data: any) => {
      console.log("📨 AI Response received:", data);
      setResponse(data.text || "No text response");
      speakText(data.text || "We are facing some issue right now.");
      
      // Once response is received, clear the loading state.
      setLoading(false);

      if (data.model_response) {
        try {
          const parsedData = JSON.parse(data.model_response); // ✅ Parse safely
          console.log("Emotion data:", parsedData);
          console.log("Detected Mood:", parsedData.mood);

          const probabilities = parsedData.probabilities;
          console.log("probabilites ", probabilities);

          if (probabilities) {
            // Convert probabilities object into the required array format
            const formattedEmotionData = Object.entries(probabilities).map(([name, value]) => ({
              name,
              value,
            }));

            // Optionally, add "Neutral" if needed
            formattedEmotionData.push({ name: "Neutral", value: 5 });

            setEmotionData(formattedEmotionData);
            console.log("Settted emotion data ", formattedEmotionData);

            // Create a new recording history entry with current timestamp
            const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const newEntry = { timestamp, emotions: formattedEmotionData };

            // Update recordingHistory state and localStorage
            setRecordingHistory((prevHistory) => {
              const updatedHistory = [...prevHistory, newEntry];
              localStorage.setItem("recordingHistory", JSON.stringify(updatedHistory));
              return updatedHistory;
            });
          } else {
            console.warn("⚠️ Probabilities data is missing or undefined");
            setEmotionData(null);
          }
        } catch (error) {
          console.error("❌ Failed to parse model_response:", error);
          setEmotionData(null); // Handle parsing error gracefully
        }
      } else {
        console.warn("⚠️ model_response is missing or undefined");
        setEmotionData(null);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket.IO Disconnected");
    });

    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      setLoading(false); // Ensure loading is false when starting recording

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = () => {
          if (socket) {
            console.log("✅ Sending audio data...");
            const audioBase64 = reader.result?.toString().split(",")[1];
            socket.emit("message", JSON.stringify({ audio: audioBase64, type: "audio_data" }));
            // After stopping, set loading to true until we get a response.
            setLoading(true);
          } else {
            console.error("❌ Socket not initialized");
          }
        };

        reader.readAsDataURL(audioBlob);
        setIsRecording(false);
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("❌ Error accessing microphone:", error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
      }
    }
    // Optionally, show a polite waiting message while loading is true.
    const politeStatements = [
  "Thank you for your patience! We’re almost there and truly appreciate your understanding.",
  "You’re doing great! We’re wrapping up and grateful for your patience.",
  "We appreciate your patience! We’re giving this our full attention.",
  "Hang tight! We’re finalizing things and appreciate your understanding.",
  "Thanks for waiting! We’re making sure everything is just right.",
  "We’re almost done! Your patience means a lot to us.",
  "Your patience is amazing! We’ll be with you shortly.",
  "We’re just about there! Thanks for sticking with us.",
  "Good things take time! We appreciate your patience.",
  "You’ve been wonderful! We’ll be ready in no time.",
  "Thanks for waiting! We’re taking extra care behind the scenes.",
  "Almost there! We truly appreciate your patience.",
  "Everything’s coming together! Thanks for waiting.",
  "We’re working hard to make this special. Thanks for your patience!",
  "Just a little longer! We appreciate you sticking with us.",
  "We’re so close! Thanks for trusting the process.",
  "Your patience means the world to us! Almost ready.",
  "You’ve been so patient! We truly appreciate it.",
  "We’re almost ready! Thanks for your understanding.",
  "Getting closer! Your patience makes all the difference.",
  "Thank you for waiting! We’re finishing up now.",
  "You’ve been amazing! Just a few more moments.",
  "Thanks for trusting us! We’ll be ready soon.",
  "We’re wrapping things up! Your patience is truly appreciated.",
  "Almost there! Thanks for your understanding.",
  "So close! We appreciate your kindness and patience.",
  "Your patience is remarkable! We’re nearly finished.",
  "Thank you for sticking with us! We’re almost done.",
  "We appreciate your patience! It’ll be worth the wait."
];
    const randomIndex = Math.floor(Math.random() * politeStatements.length);
    const statement = politeStatements[randomIndex];

    setTimeout(() => {
      speakText(statement);
    }, 200);
  };

  const speakText = (text: string, emotion?: string) => {
    if (!text) return;

    let politeStatement = " ";
    switch (emotion) {
      case "happy":
        politeStatement =
          "You seem to be in such a wonderful mood today! It's great to see you so positive and cheerful. I hope the rest of your day is just as bright and uplifting!";
        break;
      case "sad":
        politeStatement =
          "I'm truly sorry you're feeling this way. I know it can be tough, but remember you're not alone – I'm here to assist you and support you through it. Together, we’ll get through this.";
        break;
      case "angry":
        politeStatement =
          "I can sense some frustration in your voice. I understand that things might feel a bit overwhelming, but take a moment to breathe – I’ll do my best to help you work through it and ease the tension.";
        break;
      case "neutral":
        politeStatement =
          "It seems like you’re in a calm and steady state today, which is wonderful. I’m here if you need anything or just want to talk through something. Let me know how I can assist you in any way.";
        break;
      default:
        politeStatement =
          "I’m here to help with anything you need, no matter the situation. Feel free to share what’s on your mind, and I’ll do my best to assist you in the best way possible.";
    }

    const combinedText = politeStatement + text;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
          <div className="flex gap-2 items-center text-primary">
            <Mic className="h-6 w-6" />
            <span className="text-xl font-bold">EmotionVox</span>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center md:space-x-2 space-x-1">
              <Link href="#about">
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4 mr-2" /> About
                </Button>
              </Link>
              <Link href="https://github.com/uttamseervi/emotions-augment-ai-hackathon" target="_blank">
                <Button variant="ghost" size="sm">
                  <Github className="h-4 w-4 mr-2" /> GitHub
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Buttons to select the section */}
      <div className="container mx-auto my-4 flex gap-4 justify-center">
        <Button
          onClick={() => setSelectedSection("section1")}
          variant={selectedSection === "section1" ? "default" : "outline"}
        >
          Section 1 (Speech Analyzer)
        </Button>
        <Button
          onClick={() => setSelectedSection("section2")}
          variant={selectedSection === "section2" ? "default" : "outline"}
        >
          Section 2 (Record Voice)
        </Button>
      </div>

      {/* Toggle Recording History Button */}
      <div className="container mx-auto my-4 flex justify-center gap-3">
        <Button onClick={() => setShowHistory((prev) => !prev)}>
          {showHistory ? "Hide Recording History" : "Show Recording History"}
        </Button>
        <Button onClick={() => deleteHistory()}>
          Delete Recording History
        </Button>
      </div>

      {/* Render section based on button selection */}
      {selectedSection === "section2" && (
        <section className="flex items-center mx-auto">
          <main className="flex">
            <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-16">
              <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                  Detect Emotions in Your Voice
                </h1>
                <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                  Our AI-powered tool analyzes your speech to identify emotions in real-time (Talk to our Ai-Agent).
                </p>
                <div className="space-x-4">
                  {!isRecording && !loading ? (
                    <Button size="lg" className="gap-2" onClick={startRecording}>
                      <Mic className="h-4 w-4" /> Start Recording
                    </Button>
                  ) : isRecording ? (
                    <Button size="lg" className="gap-2 bg-red-500 hover:bg-red-600" onClick={stopRecording}>
                      <MicOff className="h-4 w-4" /> Stop Recording
                    </Button>
                  ) : (
                    <Button size="lg" className="gap-2" disabled>
                      Loading...
                    </Button>
                  )}
                </div>
                {response && (
                  <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg max-w-[42rem] w-full">
                    <h3 className="font-medium mb-2">AI Response:</h3>
                    <p className="text-lg">{response}</p>
                  </div>
                )}
              </div>
            </section>
          </main>
        </section>
      )}

      {selectedSection === "section1" && (
        <section id="demo" className="container py-8 md:py-12 lg:py-16 flex-1">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
              Speech Emotion Analyzer
            </h2>
            <span className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Speak into your microphone and our algorithm will analyze your voice to detect emotions
              <p>(Record your voice and send it to our model).</p>
            </span>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-1 md:max-w-[64rem] md:grid-cols-1 lg:max-w-[64rem]">
            <EmotionRecorder />
          </div>
        </section>
      )}

      {emotionData && (
        <div className="flex items-center justify-center flex-col">
          <h1 className="text-2xl font-semibold">Report while talking to our Ai-agent</h1>
          <EmotionVisualizer emotionData={emotionData} recordingHistory={recordingHistory} />
        </div>
      )}

      {/* Recording History Card - toggled via button */}
      {showHistory && (
        <Card className="mx-auto my-4 w-full max-w-4xl">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Recording History</h3>
            <div className="space-y-4">
              {recordingHistory?.map((record, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Recording at {record.timestamp}</span>
                    <span className="text-sm text-muted-foreground">
                      Primary: {record.emotions[0].name} ({record.emotions[0].value}%)
                    </span>
                  </div>
                  <div className="h-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={record.emotions} layout="vertical" margin={{ top: 0, right: 0, left: 60, bottom: 0 }}>
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {record?.emotions?.map((entry: { name: string; }, i: any) => (
                            <Cell key={`cell-${i}`} fill={getEmotionColor(entry.name)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <Footer />
      </section>
    </div>
  );
}
