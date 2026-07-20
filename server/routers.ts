import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut, storageGetSignedUrl } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dictate: router({
    /**
     * Reformate un texte dicté brut (sans ponctuation) en ajoutant
     * automatiquement la ponctuation, les majuscules et les paragraphes
     * appropriés via LLM.
     */
    punctuate: publicProcedure
      .input(z.object({ text: z.string().max(2000) }))
      .mutation(async ({ input }) => {
        if (!input.text.trim()) return { result: "" };
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "Tu es un assistant de correction orthographique pour du français oral. " +
                "Tu reçois un texte dicté brut, sans ponctuation ni majuscules. " +
                "Ton rôle est d'ajouter la ponctuation correcte (virgules, points, points d'interrogation, etc.), " +
                "les majuscules en début de phrase et après les points, et de corriger les éventuelles erreurs de transcription évidentes. " +
                "IMPORTANT : ne modifie PAS le contenu, ne réécris PAS les phrases, n'ajoute PAS de mots. " +
                "Retourne UNIQUEMENT le texte corrigé, sans explication ni commentaire.",
            },
            {
              role: "user",
              content: input.text,
            },
          ],
        });
        const result = (response as any)?.choices?.[0]?.message?.content ?? input.text;
        return { result: typeof result === "string" ? result.trim() : input.text };
      }),
    /**
     * Transcrit un fichier audio (base64) via Whisper puis reformate via LLM.
     * Utilisé comme fallback sur iOS/Safari où Web Speech API n'est pas disponible.
     * Approche : upload S3 → URL signée → transcribeAudio (Whisper) → LLM ponctuation.
     */
    transcribe: publicProcedure
      .input(z.object({
        audioBase64: z.string(),   // données audio encodées en base64
        mimeType: z.string(),      // ex: "audio/mp4", "audio/webm"
      }))
      .mutation(async ({ input }) => {
        // 1. Décoder le base64 en Buffer
        const audioBuffer = Buffer.from(input.audioBase64, "base64");
        const ext = input.mimeType.includes("mp4") || input.mimeType.includes("m4a") ? "m4a"
          : input.mimeType.includes("webm") ? "webm"
          : input.mimeType.includes("ogg") ? "ogg"
          : input.mimeType.includes("wav") ? "wav"
          : "m4a";
        // 2. Uploader vers S3 (stockage temporaire)
        let key: string;
        try {
          const uploaded = await storagePut(
            `dictate-tmp/recording.${ext}`,
            audioBuffer,
            input.mimeType,
          );
          key = uploaded.key;
        } catch (e: any) {
          throw new Error(`Upload audio échoué : ${e?.message || "erreur inconnue"}`);
        }
        // 3. Obtenir une URL signée accessible par Whisper
        let signedUrl: string;
        try {
          signedUrl = await storageGetSignedUrl(key);
        } catch (e: any) {
          throw new Error(`URL signée échouée : ${e?.message || "erreur inconnue"}`);
        }
        // 4. Transcrire via Whisper (helper officiel)
        const whisperResult = await transcribeAudio({
          audioUrl: signedUrl,
          language: "fr",
          prompt: "Transcription en français d'un contrôle proprété de train OUIGO.",
        });
        if ("error" in whisperResult) {
          const detail = (whisperResult as any).details || "";
          throw new Error(`Transcription échouée (${whisperResult.error})${detail ? " : " + detail : ""}`);
        }
        const rawText = whisperResult.text?.trim() || "";
        if (!rawText) return { result: "" };
        // 5. Reformater via LLM (ponctuation automatique) — si échec, retourner le texte brut
        try {
          const llmResp = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "Tu es un assistant de correction orthographique pour du français oral. "
                  + "Tu reçois un texte dicté brut, sans ponctuation ni majuscules. "
                  + "Ton rôle est d'ajouter la ponctuation correcte (virgules, points, points d'interrogation, etc.), "
                  + "les majuscules en début de phrase et après les points, et de corriger les éventuelles erreurs de transcription évidentes. "
                  + "IMPORTANT : ne modifie PAS le contenu, ne réécris PAS les phrases, n'ajoute PAS de mots. "
                  + "Retourne UNIQUEMENT le texte corrigé, sans explication ni commentaire.",
              },
              { role: "user", content: rawText },
            ],
          });
          const result = (llmResp as any)?.choices?.[0]?.message?.content ?? rawText;
          return { result: typeof result === "string" ? result.trim() : rawText };
        } catch {
          // LLM indisponible : retourner le texte brut Whisper sans ponctuation automatique
          return { result: rawText };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
