// =======================================================
// FINANCE MATURITY DIAGNOSTIC — STATE MACHINE (v5.1 FINAL)
// =======================================================

// Allowed state transitions for run_areas:
// NOT_STARTED → IN_PROGRESS → COMPLETED → LOCKED

export type AreaStatus =
    | "not_started"
    | "in_progress"
    | "completed"
    | "locked";

export const AREA_FLOW: Record<AreaStatus, AreaStatus[]> = {
    not_started: ["in_progress"],
    in_progress: ["completed"],
    completed: ["locked"], // no automatic path backwards
    locked: [],            // frozen until admin unlocks
};

// -------------------------------------------------------
// Error Types
// -------------------------------------------------------

export class StateTransitionError extends Error {
    status: AreaStatus;
    method: string;

    constructor(method: string, status: AreaStatus, message?: string) {
        super(message || `Invalid state transition in ${method} for status ${status}`);
        this.status = status;
        this.method = method;
    }
}

export class InvalidOperationError extends Error {
    constructor(message: string) {
        super(message);
    }
}

// -------------------------------------------------------
// Guard Helpers
// -------------------------------------------------------

/**
 * Ensures that an operation is allowed in the current area status.
 *
 * Example:
 *   assertCanWriteMCQ("in_progress")  // OK
 *   assertCanWriteMCQ("completed")    // throws
 */
export function assertCanWriteMCQ(status: AreaStatus) {
    if (status === "locked" || status === "completed") {
        throw new StateTransitionError(
            "save_mcq_answers",
            status,
            `Cannot modify MCQs when area is ${status}`
        );
    }
}

/**
 * Clarifier generation (3 core questions) is allowed only when:
 * - MCQs are complete, and
 * - area is in_progress
 */
export function assertCanGenerateCoreClarifiers(status: AreaStatus) {
    if (status !== "in_progress") {
        throw new StateTransitionError(
            "generate_core_clarifiers",
            status,
            `Core clarifiers can only be generated when area is in_progress`
        );
    }
}

/**
 * Follow-up clarifiers (2 questions) allowed only when:
 * - core clarifiers exist
 * - area is in_progress
 */
export function assertCanGenerateFollowups(status: AreaStatus) {
    if (status !== "in_progress") {
        throw new StateTransitionError(
            "generate_followup_clarifiers",
            status,
            `Follow-up clarifiers can only be generated when area is in_progress`
        );
    }
}

/**
 * Scoring (evaluate_area) allowed only when:
 * - all 5 clarifier answers exist
 * - area is in_progress
 */
export function assertCanScoreArea(status: AreaStatus) {
    if (status !== "in_progress") {
        throw new StateTransitionError(
            "evaluate_area",
            status,
            `Area can only be evaluated when status is in_progress`
        );
    }
}

/**
 * Prevents ANY writes once area is completed/locked,
 * unless explicitly unlocked by an admin.
 */
export function assertWritable(status: AreaStatus, method: string) {
    if (status === "completed" || status === "locked") {
        throw new StateTransitionError(
            method,
            status,
            `${method} is not allowed when area is ${status}`
        );
    }
}

// -------------------------------------------------------
// Transition Helper
// -------------------------------------------------------

/**
 * Returns true if statusA → statusB is a valid transition.
 */
export function canTransition(from: AreaStatus, to: AreaStatus): boolean {
    return AREA_FLOW[from]?.includes(to) ?? false;
}

/**
 * Throws if an invalid transition is attempted.
 */
export function assertTransition(from: AreaStatus, to: AreaStatus) {
    if (!canTransition(from, to)) {
        throw new StateTransitionError(
            "transition",
            from,
            `Invalid transition: ${from} → ${to}`
        );
    }
}

// -------------------------------------------------------
// Dirty Flag Handling (v5.1 Gemini Fix)
// -------------------------------------------------------

/**
 * When MCQ values change:
 *   - delete all clarifier questions
 *   - delete all clarifier answers
 *   - delete area assessment
 *   - mark area.is_dirty = true
 *   - force status back to "in_progress"
 *
 * This helper only describes the logic — the actual
 * DB operations happen inside the edge function.
 */
export function handleDownstreamInvalidation() {
    return {
        deleteClarifiers: true,
        deleteClarifierAnswers: true,
        deleteAssessment: true,
        setDirty: true,
        forceStatus: "in_progress" as AreaStatus,
    };
}
