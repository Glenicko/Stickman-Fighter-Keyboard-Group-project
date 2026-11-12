import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class test {
    private static final String[] ATTACK_WORDS = {
        "HADOUKEN", "SHORYUKEN", "LIGHTNING", "THUNDER", "STRIKE",
        "SLASH", "PUNISH", "DRAGON", "COMBO", "TAKEDOWN"
    };

    private static final String[] BLOCK_WORDS = {
        "SHIELD", "PARRY", "DEFEND", "BARRIER", "COUNTER"
    };

    private static final String[] SPECIAL_WORDS = {
        "ULTIMATESTRIKE", "KEYBOARDWARRIOR", "DISASTERBLAST", "DESTRUCTION"
    };

    public static String getRandomSequence(String type) {
        Random rand = new Random();
        switch (type.toUpperCase()) {
            case "ATTACK":
                return ATTACK_WORDS[rand.nextInt(ATTACK_WORDS.length)];
            case "BLOCK":
                return BLOCK_WORDS[rand.nextInt(BLOCK_WORDS.length)];
            case "SPECIAL":
                return SPECIAL_WORDS[rand.nextInt(SPECIAL_WORDS.length)];
            default:
                return generateRandomCapitalSequence(6);
        }
    }

    public static String generateRandomCapitalSequence(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        StringBuilder sb = new StringBuilder();
        Random rand = new Random();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(rand.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public static int calculateWPM(int correctChars, double timeInSeconds) {
        if (timeInSeconds <= 0) return 0;
        double words = (correctChars / 5.0);
        double minutes = timeInSeconds / 60.0;
        return (int) Math.round(words / minutes);
    }

    public static void main(String[] args) {
        System.out.println("=== KEYBOARD WARRIOR BACKEND ENGINE ===");
        System.out.println("Generated Attack Word: " + getRandomSequence("ATTACK"));
        System.out.println("Generated Defense Word: " + getRandomSequence("BLOCK"));
        System.out.println("Generated Special Word: " + getRandomSequence("SPECIAL"));
        System.out.println("Sample WPM (50 chars in 10s): " + calculateWPM(50, 10.0));
    }
}