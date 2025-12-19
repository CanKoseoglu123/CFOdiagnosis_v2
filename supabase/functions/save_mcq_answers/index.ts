// =====================================================
// save_mcq_answers — v5.1 FINAL
// =====================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { assertCanWriteMCQ, handleDownstreamInvalidation } from "../../../src/shared/stateMachine.ts";

serve(async (req) => {
    try {
        // -----------------------------------------------
        // Parse request
        // -----------------------------------------------
        const { run_area_id, answers } = await req.json();

        if (!run_area_id || !Array.isArray(answers)) {
            return new Response(
                JSON.stringify({ error: "Missing run_area_id or answers[]" }),
                { status: 400 }
            );
        }

        // -----------------------------------------------
        // Supabase client (SERVICE ROLE)
        // -----------------------------------------------
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // -----------------------------------------------
        // Load area state
        // -----------------------------------------------
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

        // -----------------------------------------------
        // State Machine Guard: MCQ writes only allowed
        // when status is not_started or in_progress
        // -----------------------------------------------
        try {
            assertCanWriteMCQ(area.status);
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 400,
            });
        }

        // -----------------------------------------------
        // Load existing answers to detect changes
        // -----------------------------------------------
        const { data: existingAnswers } = await supabase
            .from("run_mcq_answers")
            .select("question_id, answer_value")
            .eq("run_area_id", run_area_id);

        // Convert to map for easy comparison
        const existingMap = new Map(
            (existingAnswers || []).map((a: any) => [a.question_id, a.answer_value])
        );

        let mcqChanged = false;

        for (const ans of answers) {
            if (existingMap.get(ans.question_id) !== ans.answer_value) {
                mcqChanged = true;
                break;
            }
        }

        // -----------------------------------------------
        // Upsert answers
        // -----------------------------------------------
        const { error: upsertErr } = await supabase.from("run_mcq_answers").upsert(
            answers.map((a) => ({
                run_area_id,
                question_id: a.question_id,
                answer_value: a.answer_value,
            })),
            { onConflict: "run_area_id,question_id" }
        );

        if (upsertErr) {
            return new Response(JSON.stringify({ error: upsertErr.message }), {
                status: 500,
            });
        }

        // -----------------------------------------------
        // If MCQs changed → invalidate downstream data
        // -----------------------------------------------
        if (mcqChanged) {
            const invalidate = handleDownstreamInvalidation();

            // Delete clarifier questions
            await supabase
                .from("run_clarifier_questions")
                .delete()
                .eq("run_area_id", run_area_id);

            // Delete clarifier answers
            await supabase
                .from("run_clarifier_answers")
                .delete()
                .in(
                    "clarifier_question_id",
                    (
                        await supabase
                            .from("run_clarifier_questions")
                            .select("id")
                            .eq("run_area_id", run_area_id)
                    ).data?.map((q: any) => q.id) || []
                );

            // Delete assessment
            await supabase
                .from("run_assessments")
                .delete()
                .eq("run_area_id", run_area_id);

            // Reset area status + dirty flag
            await supabase
                .from("run_areas")
                .update({
                    status: invalidate.forceStatus,
                    is_dirty: true,
                })
                .eq("id", run_area_id);
        }

        // -----------------------------------------------
        // Return success
        // -----------------------------------------------
        return new Response(
            JSON.stringify({
                success: true,
                mcqChanged,
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
        });
    }
});
