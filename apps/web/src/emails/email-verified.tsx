import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import { emailStyles } from "./styles"

export interface EmailVerifiedEmailProps {
  email: string
  appName?: string
}

export function EmailVerifiedEmail({
  email,
  appName = "Fenr",
}: EmailVerifiedEmailProps) {
  const previewText = `Your ${appName} email has been verified`

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Section>
            <Text style={emailStyles.logo}>{appName}</Text>
            <Heading style={emailStyles.heading}>Email verified</Heading>
            <Text style={emailStyles.paragraph}>
              Your email address (
              <strong style={emailStyles.boldText}>{email}</strong>) has been
              successfully verified for your {appName} account.
            </Text>
            <Text style={emailStyles.paragraph}>
              You now have full access to your account and workspace features.
            </Text>
            <Hr style={emailStyles.hr} />
            <Text style={emailStyles.footer}>
              If you didn't create an account or verify this email address,
              please secure your account or contact support immediately.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailVerifiedEmail
