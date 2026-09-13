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

export interface MagicLinkEmailProps {
  url: string
  email?: string
  expiresInMinutes?: number
}

export function MagicLinkEmail({
  url,
  email,
  expiresInMinutes = 10,
}: MagicLinkEmailProps) {
  const previewText = "Sign in to Fenr"

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Section>
            <Text style={emailStyles.logo}>Fenr</Text>
            <Heading style={emailStyles.heading}>Sign in to Fenr</Heading>
            <Text style={emailStyles.paragraph}>
              {email ? (
                <>
                  Click the button below to sign in to your Fenr account (
                  <strong style={emailStyles.boldText}>{email}</strong>).
                </>
              ) : (
                "Click the button below to sign in to your Fenr account."
              )}
            </Text>
            <Section style={emailStyles.buttonContainer}>
              <Button style={emailStyles.button} href={url}>
                Sign In
              </Button>
            </Section>
            <Text style={emailStyles.paragraph}>
              {`This link will expire in ${expiresInMinutes} ${expiresInMinutes === 1 ? "minute" : "minutes"} and can only be used once.`}
            </Text>
            <Hr style={emailStyles.hr} />
            <Text style={emailStyles.fallbackNotice}>
              If the button doesn't work, copy and paste this link into your
              browser:
            </Text>
            <Link href={url} style={emailStyles.linkText}>
              {url}
            </Link>
            <Hr style={emailStyles.hr} />
            <Text style={emailStyles.footer}>
              If you didn't request this email, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail
