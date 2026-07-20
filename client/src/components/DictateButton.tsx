import { Mic, MicOff, MicVocal } from "lucide-react";
import { useCallback } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DictateButtonProps {
  /** Called with the transcribed text to append or replace */
  onTranscript: (text: string) => void;
  /** Whether to append (default) or replace the field value */
  mode?: "append" | "replace";
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function DictateButton({ onTranscript, mode = "append", className, size = "sm" }: DictateButtonProps) {
  const handleResult = useCallback(
    (text: string) => {
      onTranscript(mode === "append" ? text : text);
    },
    [onTranscript, mode]
  );

  const { status, start, stop } = useSpeechRecognition(handleResult);

  if (status === "unsupported") {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        disabled
        className={cn("opacity-40 cursor-not-allowed", className)}
        title="Reconnaissance vocale non disponible sur ce navigateur"
      >
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  const isListening = status === "listening";

  return (
    <Button
      type="button"
      variant={isListening ? "default" : "outline"}
      size={size}
      onClick={isListening ? stop : start}
      className={cn(
        "transition-all",
        isListening && "bg-red-500 hover:bg-red-600 text-white animate-pulse",
        status === "error" && "border-red-400 text-red-500",
        className
      )}
      title={isListening ? "Arrêter la dictée" : "Dicter (reconnaissance vocale)"}
    >
      {isListening ? <MicVocal className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <span className="ml-1 text-xs">{isListening ? "Écoute…" : "Dicter"}</span>
    </Button>
  );
}
