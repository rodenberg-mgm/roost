import { TripInfoSection } from "@/components/trip-info-section";
import { SensitiveInfoSection } from "@/components/sensitive-info-section";
import { StampBadge } from "@/components/stamp-badge";
import { FeatureTiles } from "@/components/feature-tiles";
import { PropertyLinkChip } from "@/components/property-link-chip";
import { CabinScene } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  ScrollText,
  Lightbulb,
  Package,
  Pencil,
  Send,
  Share2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/** Host-only "Add" prompt shown in an otherwise-empty info section. */
function AddPrompt({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-forest transition-colors hover:text-forest-dark"
    >
      <Plus className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** Small "Edit" action shown top-right of a populated section. */
function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="font-mono text-[0.65rem] uppercase tracking-wider text-forest transition-colors hover:text-forest-dark"
    >
      Edit
    </Link>
  );
}

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

  // Presence-only check via service-role (bypasses RLS): lets us show an
  // ungranted guest the gated reveal prompt without leaking the values, which
  // stay gated through `sensitiveInfo` above. A guest with no grant can't read
  // trip_sensitive_info at all, so without this they'd see nothing to reveal.
  const serviceClient = await createServiceClient();
  const { data: rawSensitive } = await serviceClient
    .from("trip_sensitive_info")
    .select(
      "wifi_ssid, wifi_password, door_code, gate_code, address_line, postal_code, parking_notes"
    )
    .eq("trip_id", id)
    .maybeSingle();
  const hasSensitiveData =
    !!rawSensitive &&
    Object.values(rawSensitive).some((v) => v !== null && v !== "");

  // Fetch user email for reveal dialog
  const { data: currentUser } = await supabase
    .from("users")
    .select("email")
    .eq("id", membership.userId)
    .single();

  const canEdit = isHostRole(membership.role);

  // Linked-property chip (host/co-host only). Read name via service-role since
  // `properties` is owner-only under RLS — a co-host who isn't the owner still
  // needs the name. The "Edit property" link shows only to the actual owner.
  let linkedProperty: { id: string; name: string; canEdit: boolean } | null = null;
  if (canEdit && trip.property_id) {
    const { data: prop } = await serviceClient
      .from("properties")
      .select("id, name, owner_user_id")
      .eq("id", trip.property_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (prop) {
      linkedProperty = {
        id: prop.id,
        name: prop.name,
        canEdit: prop.owner_user_id === membership.userId,
      };
    }
  }

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
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          My Trips
        </Link>

        <div className="mb-2">
          <StampBadge variant="forest">Trip Guide</StampBadge>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase text-ink">{trip.name}</h1>
            <p className="mt-1 text-sm text-ink-light">{dateDisplay}</p>
          </div>
          {canEdit && (
            <div className="flex gap-1.5">
              <Link
                href={`/trips/${id}/edit`}
                className="flex h-9 w-9 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <Link
                href={`/trips/${id}/invite`}
                className="flex h-9 w-9 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest"
              >
                <Send className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Linked property */}
      {linkedProperty && (
        <div className="mb-5">
          <PropertyLinkChip
            propertyId={linkedProperty.id}
            propertyName={linkedProperty.name}
            canEdit={linkedProperty.canEdit}
          />
        </div>
      )}

      {/* Welcome banner */}
      <div className="relative mb-5 overflow-hidden rounded-card border bg-card shadow-card">
        <CabinScene className="mx-auto h-44 w-full" />
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-3">
          <StampBadge variant="forest">Welcome</StampBadge>
          <StampBadge variant="kraft">Relax</StampBadge>
          <StampBadge variant="brick">Enjoy</StampBadge>
        </div>
      </div>

      {/* Quick-access tiles */}
      <div className="mb-5">
        <FeatureTiles tripId={id} />
      </div>

      {/* Content sections */}
      <div className="space-y-3">
        {/* Dates */}
        <TripInfoSection id="trip-info" icon={Calendar} title="Dates">
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
          id="guests"
          icon={Users}
          title={`Guests (${members?.length || 0})`}
          action={
            canEdit ? (
              <Link
                href={`/trips/${id}/invite`}
                className="font-mono text-[0.65rem] uppercase tracking-wider text-forest transition-colors hover:text-forest-dark"
              >
                Invite
              </Link>
            ) : undefined
          }
        >
          <ul className="space-y-2.5">
            {members?.map((m) => {
              const userRaw = m.users as unknown;
              const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as { display_name: string; email: string } | null;
              const name = user?.display_name || m.invited_email || "Unknown";
              const isJoined = !!m.joined_at;
              const initial = name.charAt(0).toUpperCase();
              return (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sand font-display text-xs font-bold uppercase text-ink-light">
                    {initial}
                  </div>
                  <span className="flex-1 text-ink">{name}</span>
                  <span className="rounded-badge bg-sand/50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
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

        {/* House Rules — shown to all when present; empty "Add" prompt for hosts */}
        {((trip.house_rules as string[])?.length > 0 || canEdit) && (
          <TripInfoSection
            icon={ScrollText}
            title="House Rules"
            action={(trip.house_rules as string[])?.length > 0 && canEdit ? <EditLink href={`/trips/${id}/edit`} /> : undefined}
          >
            {(trip.house_rules as string[])?.length > 0 ? (
              <ul className="space-y-1.5">
                {(trip.house_rules as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <AddPrompt href={`/trips/${id}/edit`} label="Add house rules" />
            )}
          </TripInfoSection>
        )}

        {/* Local Tips */}
        {((trip.local_tips as string[])?.length > 0 || canEdit) && (
          <TripInfoSection
            icon={Lightbulb}
            title="Local Tips"
            action={(trip.local_tips as string[])?.length > 0 && canEdit ? <EditLink href={`/trips/${id}/edit`} /> : undefined}
          >
            {(trip.local_tips as string[])?.length > 0 ? (
              <ul className="space-y-1.5">
                {(trip.local_tips as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <AddPrompt href={`/trips/${id}/edit`} label="Add local tips" />
            )}
          </TripInfoSection>
        )}

        {/* Stocked Items */}
        {((trip.stocked_items as string[])?.length > 0 || canEdit) && (
          <TripInfoSection
            icon={Package}
            title="Stocked Items"
            action={
              (trip.stocked_items as string[])?.length > 0 && canEdit ? (
                <EditLink href={`/trips/${id}/edit`} />
              ) : undefined
            }
          >
            {(trip.stocked_items as string[])?.length > 0 ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(trip.stocked_items as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-1.5 text-sm text-ink">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <AddPrompt href={`/trips/${id}/edit`} label="Add stocked items" />
            )}
          </TripInfoSection>
        )}

        {/* Sensitive Info */}
        <SensitiveInfoSection
          tripId={id}
          userEmail={currentUser?.email || ""}
          userRole={membership.role}
          requirePin={trip.require_pin_to_view}
          initialData={sensitiveInfo}
          hasSensitiveData={hasSensitiveData}
          hasAccess={hasSensitiveAccess}
        />

        {/* Share button */}
        {canEdit && (
          <Button asChild size="lg" className="w-full text-base">
            <Link href={`/trips/${id}/invite`}>
              <Share2 className="h-4 w-4" />
              Share with Guests
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
