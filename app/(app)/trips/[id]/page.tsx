import { TripInfoSection } from "@/components/trip-info-section";
import { SensitiveInfoSection } from "@/components/sensitive-info-section";
import { StampBadge } from "@/components/stamp-badge";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  ScrollText,
  Lightbulb,
  Package,
  Settings,
  Send,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface TripPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);
  const supabase = await createClient();

  // Fetch trip data
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) notFound();

  // Fetch members with user info via foreign key join
  const { data: members } = await supabase
    .from("trip_members")
    .select("id, role, joined_at, invited_email, user_id, users:user_id(display_name, email)")
    .eq("trip_id", id);

  // Fetch sensitive info (RLS allows host/co-host or users with sensitive grant)
  const { data: sensitiveInfo } = await supabase
    .from("trip_sensitive_info")
    .select("*")
    .eq("trip_id", id)
    .single();

  // Check if user has a sensitive grant
  const { data: sensitiveGrant } = await supabase
    .from("trip_grants")
    .select("level")
    .eq("trip_id", id)
    .eq("user_id", membership.userId)
    .eq("level", "sensitive")
    .single();

  const hasSensitiveAccess = isHostRole(membership.role) || !!sensitiveGrant;

  // Fetch user email for reveal dialog
  const { data: currentUser } = await supabase
    .from("users")
    .select("email")
    .eq("id", membership.userId)
    .single();

  const canEdit = isHostRole(membership.role);

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const startDate = formatDate(trip.starts_on);
  const endDate = formatDate(trip.ends_on);
  const dateDisplay =
    startDate && endDate
      ? `${startDate} — ${endDate}`
      : startDate
        ? `Starting ${startDate}`
        : "Dates TBD";

  return (
    <div>
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          My Trips
        </Link>
        <StampBadge variant="forest">Trip Guide</StampBadge>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{trip.name}</h1>
            {(trip.city || trip.region) && (
              <p className="mt-1 text-sm text-ink-light">
                {[trip.city, trip.region].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Link
                href={`/trips/${id}/edit`}
                className="flex h-9 w-9 items-center justify-center rounded-button text-ink-light hover:bg-sand/50 hover:text-ink"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <Link
                href={`/trips/${id}/invite`}
                className="flex h-9 w-9 items-center justify-center rounded-button text-ink-light hover:bg-sand/50 hover:text-ink"
              >
                <Send className="h-4 w-4" />
              </Link>
              <Link
                href={`/trips/${id}/settings`}
                className="flex h-9 w-9 items-center justify-center rounded-button text-ink-light hover:bg-sand/50 hover:text-ink"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {/* Dates */}
        <TripInfoSection icon={Calendar} title="Dates">
          <p className="text-sm text-ink">{dateDisplay}</p>
        </TripInfoSection>

        {/* Location */}
        {(trip.city || trip.region) && (
          <TripInfoSection icon={MapPin} title="Location">
            <p className="text-sm text-ink">
              {[trip.city, trip.region].filter(Boolean).join(", ")}
            </p>
          </TripInfoSection>
        )}

        {/* Guests */}
        <TripInfoSection
          icon={Users}
          title={`Guests (${members?.length || 0})`}
          action={
            canEdit ? (
              <Link
                href={`/trips/${id}/invite`}
                className="text-xs text-forest hover:text-forest-dark"
              >
                Invite
              </Link>
            ) : undefined
          }
        >
          <ul className="space-y-2">
            {members?.map((m) => {
              const userRaw = m.users as unknown;
              const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as { display_name: string; email: string } | null;
              const name = user?.display_name || m.invited_email || "Unknown";
              const isJoined = !!m.joined_at;
              return (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{name}</span>
                  <span className="text-xs text-ink-light">
                    {m.role === "host"
                      ? "Host"
                      : m.role === "co-host"
                        ? "Co-host"
                        : isJoined
                          ? "Joined"
                          : "Invited"}
                  </span>
                </li>
              );
            })}
          </ul>
        </TripInfoSection>

        {/* House Rules */}
        {trip.house_rules && (
          <TripInfoSection icon={ScrollText} title="House Rules">
            <p className="whitespace-pre-wrap text-sm text-ink">{trip.house_rules}</p>
          </TripInfoSection>
        )}

        {/* Local Tips */}
        {trip.local_tips && (
          <TripInfoSection icon={Lightbulb} title="Local Tips">
            <p className="whitespace-pre-wrap text-sm text-ink">{trip.local_tips}</p>
          </TripInfoSection>
        )}

        {/* Stocked Items */}
        {trip.stocked_items && (trip.stocked_items as string[]).length > 0 && (
          <TripInfoSection icon={Package} title="Stocked Items">
            <ul className="grid grid-cols-2 gap-1">
              {(trip.stocked_items as string[]).map((item: string, i: number) => (
                <li key={i} className="text-sm text-ink">
                  • {item}
                </li>
              ))}
            </ul>
          </TripInfoSection>
        )}

        {/* Sensitive Info */}
        <SensitiveInfoSection
          tripId={id}
          userEmail={currentUser?.email || ""}
          userRole={membership.role}
          requirePin={trip.require_pin_to_view}
          initialData={sensitiveInfo}
          hasAccess={hasSensitiveAccess}
        />
      </div>
    </div>
  );
}
