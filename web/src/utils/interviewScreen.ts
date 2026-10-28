const COMPLETED_REASON = [
	"manual_candidate",
	"manual_assessor",
	"all_covered",
	"time_ceiling",
];

export const screenForReason = (reason?: string | null) => {
	if (!reason) return "complete";
	return COMPLETED_REASON.includes(reason) ? "complete" : "error";
};

export const screenForSession = (status: string, endReason?: string | null) => {
	if (status === "failed") return "error";
	if (status === "ended") return screenForReason(endReason);
	return null;
};
