import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface TripInviteEmailProps {
  tripName: string;
  hostName: string;
  tripDates: string;
  viewUrl: string;
}

export function TripInviteEmail({
  tripName,
  hostName,
  tripDates,
  viewUrl,
}: TripInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {hostName} invited you to {tripName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>You&apos;re invited to {tripName}</Heading>
          <Text style={text}>
            <strong>{hostName}</strong> has invited you to a trip on Roost.
          </Text>
          <Section style={detailsBox}>
            <Text style={detailsText}>
              <strong>Trip:</strong> {tripName}
            </Text>
            <Text style={detailsText}>
              <strong>When:</strong> {tripDates}
            </Text>
          </Section>
          <Section style={buttonSection}>
            <Button style={button} href={viewUrl}>
              View Your Trip
            </Button>
          </Section>
          <Text style={footerText}>
            You can view trip details, see the packing list, and more — no
            account needed. Create an account when you&apos;re ready to claim items
            or upload photos.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#F5F1EB",
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "480px",
};

const heading = {
  color: "#3F6A47",
  fontSize: "24px",
  fontWeight: "bold" as const,
  marginBottom: "16px",
};

const text = {
  color: "#3B3028",
  fontSize: "16px",
  lineHeight: "24px",
};

const detailsBox = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "24px 0",
};

const detailsText = {
  color: "#3B3028",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "4px 0",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#3F6A47",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "12px 32px",
  textDecoration: "none",
};

const footerText = {
  color: "#5C4F44",
  fontSize: "13px",
  lineHeight: "20px",
  marginTop: "24px",
};
