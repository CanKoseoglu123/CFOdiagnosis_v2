// =======================================================
// FINANCE MATURITY DIAGNOSTIC — SHARED TYPES (v5.1 FINAL)
// =======================================================

//
// ----------------------
// Global Dimensions
// ----------------------
//
export type Dimension =
    | "process"
    | "automation"
    | "data_quality"
    | "controls"
    | "people_skills";

export const DIMENSIONS: Dimension[] = [
    "process",
    "automation",
    "data_quality",
    "controls",
    "people_skills",
];

//
// --------------------------------------------------------
// System Tags (Strict Enum — must match scoring prompts)
// --------------------------------------------------------
//
export const SystemTag = {
    CORE_PROCESS_EXCEL: "CORE_PROCESS_EXCEL",
    NO_WORKFLOW_SUPPORT: "NO_WORKFLOW_SUPPORT",
    NO_DOCUMENTATION: "NO_DOCUMENTATION",
    LATE_ADJUSTMENTS: "LATE_ADJUSTMENTS",
    UPSTREAM_DATA_ISSUES: "UPSTREAM_DATA_ISSUES",
    REWORK_HEAVY: "REWORK_HEAVY",
    MISSING_OWNERSHIP: "MISSING_OWNERSHIP",
    POOR_HANDOFFS: "POOR_HANDOFFS",
    CAPACITY_CONSTRAINT: "CAPACITY_CONSTRAINT",
    LIMITED_AUTOMATION: "LIMITED_AUTOMATION",
    MULTI_SYSTEM_FRAGMENTATION: "MULTI_SYSTEM_FRAGMENTATION",
    DATA_QUALITY_GAPS: "DATA_QUALITY_GAPS",
} as const;

export type SystemTag = typeof SystemTag[keyof typeof SystemTag];

export type SystemTagArray = SystemTag[];

//
// --------------------------------------------------------
// MCQ Types
// --------------------------------------------------------
//
export interface MCQAnswer {
    question_id: string;
    answer_value: number; // 1–5
}

//
// --------------------------------------------------------
// Clarifier Types
// --------------------------------------------------------
//
export interface ClarifierQuestion {
    id: string;
    run_area_id: string;
    step: 1 | 2;
    question_text: string;
    topic?: string;
}

export interface ClarifierAnswer {
    id: string;
    clarifier_question_id: string;
    answer_text?: string;
    audio_ref?: string;
    transcription_status: "ok" | "failed";
}

//
// --------------------------------------------------------
// Clarifier Scoring Result (from LLM evaluator)
// --------------------------------------------------------
//
export interface ClarifierScoringResult {
    subscores: Record<Dimension, number>; // 1–5 per dimension

    systemTags: SystemTag[];
    narrativeTags: string[];

    tagQuality: "high" | "medium" | "low";
}

//
// --------------------------------------------------------
// Subscores (stored in DB)
// --------------------------------------------------------
//
export type Subscores = Record<Dimension, number>;

//
// --------------------------------------------------------
// Evidence Pack (input to Area Evaluation)
// --------------------------------------------------------
//
export interface EvidencePack {
    mcqScore: number; // weighted average 1–5
    mcqAnswers: MCQAnswer[];

    clarifierQuestions: ClarifierQuestion[];
    clarifierAnswers: ClarifierAnswer[];

    companyContext?: any; // jsonb
    pillarContext?: any;  // jsonb
    painPoints?: any;     // jsonb
    ambition?: string;
    role?: string;
}

//
// --------------------------------------------------------
// Area Assessment (output of scoring engine)
// --------------------------------------------------------
//
export interface AreaAssessment {
    area_mcq_score: number;
    clarifier_score_raw: number;
    reported_score: number;

    subscores: Subscores;

    system_tags: SystemTag[];
    narrative_tags: string[];

    contradiction_flags: {
        automation?: boolean;
        governance?: boolean;
        people?: boolean;
    };

    reliability: "low" | "medium" | "high";
}

//
// --------------------------------------------------------
// Recommendation Types (Actions)
// --------------------------------------------------------
//
export interface ActionTemplate {
    id: string;
    action_id: string;
    title: string;
    description?: string;
    dimension?: Dimension;
    prerequisites?: any;
}

export interface Recommendation {
    id: string;
    action_id: string;
    source: "deterministic" | "llm_extra";
    severity: number;
    priority: "high" | "medium" | "low";
    uplift_estimate?: number | null;
    payload?: any;
}

//
// --------------------------------------------------------
// Utility Types
// --------------------------------------------------------
//
export type ID = string;
