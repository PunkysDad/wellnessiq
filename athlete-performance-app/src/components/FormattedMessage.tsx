import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { appTheme } from '../theme/appTheme';

interface FormattedMessageProps {
  text: string;
  isUser: boolean;
}

const FormattedMessage: React.FC<FormattedMessageProps> = ({ text, isUser }) => {
  const cleanText = (text: string): string => {
    return text
      .trim()
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '');
  };

  const parseMarkdown = (text: string) => {
    const cleanedText = cleanText(text);
    const lines = cleanedText.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          const isLastElementLineBreak = React.isValidElement(lastElement) &&
            lastElement.key?.toString().startsWith('space-');
          if (!isLastElementLineBreak) {
            elements.push(<View key={`space-${lineIndex}`} style={styles.lineBreak} />);
          }
        }
        return;
      }

      if (trimmedLine === '---') {
        elements.push(<View key={lineIndex} style={styles.horizontalRule} />);
        return;
      }

      if (trimmedLine.match(/^###\s+/)) {
        elements.push(
          <Text key={lineIndex} style={[styles.header3, isUser && styles.userText]}>
            {renderInlineText(trimmedLine.replace(/^###\s+/, ''))}
          </Text>
        );
        return;
      }

      if (trimmedLine.match(/^##\s+/)) {
        elements.push(
          <Text key={lineIndex} style={[styles.header2, isUser && styles.userText]}>
            {renderInlineText(trimmedLine.replace(/^##\s+/, ''))}
          </Text>
        );
        return;
      }

      if (trimmedLine.match(/^#\s+/)) {
        elements.push(
          <Text key={lineIndex} style={[styles.header1, isUser && styles.userText]}>
            {renderInlineText(trimmedLine.replace(/^#\s+/, ''))}
          </Text>
        );
        return;
      }

      if (trimmedLine.match(/^\*(?!\*)[^*]+\*$/)) {
        const content = trimmedLine.replace(/^\*([^*]+)\*$/, '$1');
        elements.push(
          <Text key={lineIndex} style={[styles.italic, isUser && styles.userText]}>
            {content}
          </Text>
        );
        return;
      }

      if (trimmedLine.match(/^\d+\.\s/)) {
        const numberMatch = trimmedLine.match(/^(\d+\.)/);
        const content = trimmedLine.replace(/^\d+\.\s+/, '');
        elements.push(
          <View key={lineIndex} style={styles.bulletContainer}>
            <Text style={[styles.numberBullet, isUser && styles.userText]}>
              {numberMatch?.[1]}
            </Text>
            <View style={styles.bulletTextContainer}>
              <Text style={[styles.bulletText, isUser && styles.userText]}>
                {renderInlineText(content)}
              </Text>
            </View>
          </View>
        );
        return;
      }

      if (trimmedLine.match(/^[-•*]\s/)) {
        const content = trimmedLine.replace(/^[-•*]\s+/, '');
        elements.push(
          <View key={lineIndex} style={styles.bulletContainer}>
            <Text style={[styles.bullet, isUser && styles.userText]}>•</Text>
            <View style={styles.bulletTextContainer}>
              <Text style={[styles.bulletText, isUser && styles.userText]}>
                {renderInlineText(content)}
              </Text>
            </View>
          </View>
        );
        return;
      }

      elements.push(
        <View key={lineIndex} style={styles.paragraphContainer}>
          <Text style={[styles.paragraph, isUser && styles.userText]}>
            {renderInlineText(trimmedLine)}
          </Text>
        </View>
      );
    });

    return elements;
  };

  const renderInlineText = (text: string): React.ReactNode => {
    if (!text || typeof text !== 'string') return text;

    // Tokenize into bold (**...**) and italic (*...*) segments, preserving surrounding text.
    const tokenRegex = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g;
    const segments = text.split(tokenRegex).filter(s => s !== '');
    if (segments.length <= 1) return text;

    return segments.map((seg, i) => {
      if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
        return (
          <Text key={i} style={[styles.bold, isUser && styles.userText]}>
            {seg.slice(2, -2)}
          </Text>
        );
      }
      if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 2) {
        return (
          <Text key={i} style={[styles.italic, isUser && styles.userText]}>
            {seg.slice(1, -1)}
          </Text>
        );
      }
      return <Text key={i}>{seg}</Text>;
    });
  };

  return (
    <View style={styles.container}>
      {parseMarkdown(text)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  lineBreak: {
    height: 6,
  },
  header1: {
    fontSize: 18,
    fontWeight: '700',
    color: appTheme.white,
    marginVertical: 6,
  },
  header2: {
    fontSize: 17,
    fontWeight: '600',
    color: appTheme.white,
    marginVertical: 5,
  },
  header3: {
    fontSize: 16,
    fontWeight: '600',
    color: appTheme.white,
    marginVertical: 4,
  },
  paragraphContainer: {
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 22,
    color: appTheme.text,
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 3,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 16,
    color: appTheme.red,
    marginRight: 8,
    marginTop: 2,
    width: 12,
  },
  numberBullet: {
    fontSize: 16,
    color: appTheme.red,
    marginRight: 8,
    marginTop: 2,
    minWidth: 24,
    textAlign: 'left',
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletText: {
    fontSize: 16,
    lineHeight: 22,
    color: appTheme.text,
  },
  bold: {
    fontWeight: '700',
    color: appTheme.white,
  },
  italic: {
    fontStyle: 'italic',
    color: appTheme.textMuted,
  },
  userText: {
    color: appTheme.white,
  },
  horizontalRule: {
    height: 1,
    backgroundColor: appTheme.border,
    marginVertical: 12,
    width: '100%',
  },
});

export default FormattedMessage;