import { Link } from 'react-router-dom';

export default function PendingApprovalPage() {
  return (
    <>
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-[#F0654D] tracking-tight">Nectar</span>
        <p className="mt-1 text-sm text-gray-400">Your Microsoft account is verified.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-5 text-sm text-amber-900">
        <p className="font-semibold">Your account is pending approval.</p>
        <p>
          Nectar created your profile, but an administrator still needs to approve access
          before you can use the app.
        </p>
        <p>
          Department request onboarding is the next step to build. For now, ask an admin to
          review and activate your account.
        </p>
      </div>

      <div className="mt-6">
        <Link
          to="/login"
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to sign in
        </Link>
      </div>
    </>
  );
}
