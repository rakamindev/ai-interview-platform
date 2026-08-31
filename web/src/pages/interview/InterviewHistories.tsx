import underConstruction from "./assets/under-construction.jpg";

// @todo: make proper interview page, that populate interview histories
export default function InterviewHistories() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-1">
        <img src={underConstruction} alt="" />
      </div>
      <h2 className="text-center">You're authenticated!</h2>
      <h1 className="text-center">Please find interview link from recruiter</h1>
    </div>
  );
}
