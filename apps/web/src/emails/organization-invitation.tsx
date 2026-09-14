import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import { emailStyles } from "./styles"

export interface OrganizationInvitationEmailProps {
  organizationName: string
  inviterName: string
  role: string
  acceptUrl: string
  expiresInHours?: number
  personalNote?: string
}

export function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  role,
  acceptUrl,
  expiresInHours = 48,
  personalNote,
}: OrganizationInvitationEmailProps) {
  const previewText = `Join ${organizationName} on Fenr`

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Section>
            <Text style={emailStyles.logo}>Fenr</Text>
            <Heading
              style={emailStyles.heading}
            >{`Join ${organizationName} on Fenr`}</Heading>
            <Text style={emailStyles.paragraph}>
              <strong style={emailStyles.boldText}>{inviterName}</strong>
              {" has invited you to join "}
              <strong style={emailStyles.boldText}>{organizationName}</strong>
              {" as a "}
              <strong style={emailStyles.boldText}>{role}</strong>.
            </Text>
            {personalNote ? (
              <Section>
                <Text style={emailStyles.paragraph}>
                  <strong style={emailStyles.boldText}>
                    A note from {inviterName}:
                  </strong>
                </Text>
                <Text style={emailStyles.paragraph}>{personalNote}</Text>
              </Section>
            ) : null}
            <Section style={emailStyles.buttonContainer}>
              <Button style={emailStyles.button} href={acceptUrl}>
                Accept Invitation
              </Button>
            </Section>
            <Text style={emailStyles.paragraph}>
              {`This invitation will expire in ${expiresInHours} hours.`}
            </Text>
            <Hr style={emailStyles.hr} />
            <Text style={emailStyles.fallbackNotice}>
              If the button doesn't work, copy and paste this link into your
              browser:
            </Text>
            <Link href={acceptUrl} style={emailStyles.linkText}>
              {acceptUrl}
            </Link>
            <Hr style={emailStyles.hr} />
            <Text style={emailStyles.footer}>
              If you were not expecting this invitation, you can safely ignore
              this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default OrganizationInvitationEmail
