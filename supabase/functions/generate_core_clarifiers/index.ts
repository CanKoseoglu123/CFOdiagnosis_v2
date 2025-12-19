// =====================================================
// generate_core_clarifiers — v5.1 FINAL
// Creates 3 clarifier questions (Call 1)
// =====================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
    assertCanGenerateCoreClarifiers,
} from "../../../src/shared/stateMachine.ts";

serve(async (req) => {
    try {
        // -------------------------------------------
        // Parse request
        // -------------------------------------------
        const { run_area_id } = await req.json();
        if (!run_area_id) {
            return new Response(JSON.stringify({ error: "Missing run_area_id" }), {
                status: 400,
            });
        }

        // -------------------------------------------
        // Init Supabase (service key)
        // -------------------------------------------
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // -------------------------------------------
        // 1. Load area state
        // -------------------------------------------
        const { data: area, error: areaErr } = await supabase
            .from("run_areas")
            .select("status")
            .eq("id", run_area_id)
            .single();

        if (areaErr || !area) {
            return new Response(JSON.stringify({ error: "Area not found" }), {
                status: 404,
            });
        }

        // -------------------------------------------
        // State check
        // -------------------------------------------
        try {
            assertCanGenerateCoreClarifiers(area.status);
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 400,
            });
        }

        // -------------------------------------------
        // 2. Load Evidence Pack for LLM prompt
        // -------------------------------------------

        const [
            mcqRes,
            ctxRes,
        ] = await Promise.all([
            supabase
                .from("run_mcq_answers")
                .select("question_id, answer_value")
                .eq("run_area_id", run_area_id),

            supabase
                .from("run_context")
                .select("company_context, pillar_context, pain_points, ambition, role")
                .eq("run_id",
                    supabase
                        .from("run_areas")
                        .select("run_pillar_id")
                        .eq("id", run_area_id)
                        .single()
                        .then((x) => x.data?.run_pillar_id)
                )
                .single()
        ]);

        const mcqs = mcqRes.data || [];
        const ctx = ctxRes.data || {};

        // -------------------------------------------
        // 3. Build LLM prompt (Call 1)
        // -------------------------------------------

        const prompt = {
            system: "You are the Clarifier Engine for the Finance Maturity Diagnostic.",
            task: "Generate exactly 3 clarifier questions.",
            rules: [
                "Questions must be factual and non-redundant.",
                "Each question must target a distinct topic.",
                "Questions should be answerable in 1-3 sentences.",
                "No duplication. No narrative. No scoring.",
            ],
            evidence: {
                mcqs,
                company_context: ctx.company_context,
                pillar_context: ctx.pillar_context,
                pain_points: ctx.pain_points,
                ambition: ctx.ambition,
                role: ctx.role,
            },
        };

        // -------------------------------------------
        // 4. Call OpenAI LLM
        // -------------------------------------------
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiKey) {
            return new Response(
                JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
                { status: 500 }
            );
        }

        const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openaiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0,
                messages: [
                    { role: "system", content: prompt.system },
                    {
                        role: "user",
                        content: JSON.stringify({
                            task: prompt.task,
                            rules: prompt.rules,
                            evidence: prompt.evidence
                        }),
                    },
                ],
            }),
        });

        if (!llmResponse.ok) {
            const errorText = await llmResponse.text();
            return new Response(
                JSON.stringify({ error: "LLM error", detail: errorText }),
                { status: 500 }
            );
        }

        const data = await llmResponse.json();

        // Expecting: model returns an array of 3 questions
        let questions: string[] = [];
        try {
            const msg = data.choices[0].message.content;
            const parsed = JSON.parse(msg);
            questions = parsed.questions;
        } catch (err) {
            // fallback: raw text, split by newline
            const msg = data.choices[0].message.content.trim();
            questions = msg.split("\n").filter((x: string) => x.length > 8).slice(0, 3);
        }

        if (!questions || questions.length !== 3) {
            return new Response(
                JSON.stringify({ error: "LLM did not return exactly 3 questions" }),
                { status: 500 }
            );
        }

        // -------------------------------------------
        // 5. Save clarifiers in DB
        // -------------------------------------------
        const rows = questions.map((q: string) => ({
            run_area_id,
            step: 1,
            question_text: q,
            topic: null,
        }));

        const { error: insertErr } = await supabase
            .from("run_clarifier_questions")
            .insert(rows);

        if (insertErr) {
            return new Response(JSON.stringify({ error: insertErr.message }), {
                status: 500,
            });
        }

        // -------------------------------------------
        // SUCCESS
        // -------------------------------------------
        return new Response(
            JSON.stringify({
                success: true,
                clarifiers: questions,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
        });
    }
});
