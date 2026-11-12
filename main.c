#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

typedef struct {
    char name[32];
    int hp;
    int sp;
    int x_pos;
    int combo_count;
} StickmanFighter;

typedef struct {
    char action_name[32];
    int base_damage;
    int sp_cost;
} AttackCommand;

// Generates the JSON bridge required to unlock the Web Frontend
void export_c_web_bridge(StickmanFighter* player, StickmanFighter* enemy, int base_dmg, double crit_mult) {
    FILE *bridge = fopen("c_engine_bridge.json", "w");
    if (bridge != NULL) {
        fprintf(bridge, "{\n");
        fprintf(bridge, "  \"engineStatus\": \"ONLINE\",\n");
        fprintf(bridge, "  \"cMemoryPointer\": \"%p\",\n", (void*)player);
        fprintf(bridge, "  \"playerMaxHp\": %d,\n", player->hp);
        fprintf(bridge, "  \"enemyMaxHp\": %d,\n", enemy->hp);
        fprintf(bridge, "  \"hitboxRangePx\": 120,\n");
        fprintf(bridge, "  \"baseStrikeDamage\": %d,\n", base_dmg);
        fprintf(bridge, "  \"critMultiplier\": %.2f,\n", crit_mult);
        fprintf(bridge, "  \"generatedAt\": %ld\n", time(NULL));
        fprintf(bridge, "}\n");
        fclose(bridge);
        printf("[C-BRIDGE] Web dependency file 'c_engine_bridge.json' generated successfully!\n");
    } else {
        printf("[C-BRIDGE] ERROR: Could not write web bridge file.\n");
    }
}

void write_battle_log(const char* winner, int final_wpm, int max_combo) {
    FILE *log_file = fopen("c_battle_telemetry.txt", "w");
    if (log_file != NULL) {
        fprintf(log_file, "=== KEYBOARD WARRIOR C-ENGINE TELEMETRY ===\n");
        fprintf(log_file, "Winner: %s\n", winner);
        fprintf(log_file, "Recorded WPM: %d\n", final_wpm);
        fprintf(log_file, "Max Combo Achieved: %dx\n", max_combo);
        fprintf(log_file, "Timestamp: %ld\n", time(NULL));
        fclose(log_file);
        printf("[C-FILE I/O] Telemetry written to 'c_battle_telemetry.txt'.\n");
    }
}

void calculate_c_hitbox(StickmanFighter* attacker, StickmanFighter* defender, AttackCommand* cmd) {
    int distance = abs(attacker->x_pos - defender->x_pos);
    printf("[C-HITBOX] Evaluating spatial distance... Delta X: %d px\n", distance);

    if (distance <= 120) {
        int scaled_damage = cmd->base_damage + (attacker->combo_count * 3);
        if (attacker->combo_count >= 4) {
            scaled_damage = (int)(scaled_damage * 1.5);
            printf("[C-ENGINE] CRITICAL STRIKE TRIGGERED (1.5x multiplier)!\n");
        }
        defender->hp -= scaled_damage;
        if (defender->hp < 0) defender->hp = 0;
        printf("[C-HITBOX] HIT CONFIRMED! '%s' dealt %d damage. Defender HP: %d\n",
               cmd->action_name, scaled_damage, defender->hp);
    } else {
        printf("[C-HITBOX] ATTACK MISSED! Target out of range (%d px).\n", distance);
    }
}

int compute_c_wpm(int total_correct_chars, double seconds_elapsed) {
    if (seconds_elapsed <= 0.0) return 0;
    return (int)(((double)total_correct_chars / 5.0) / (seconds_elapsed / 60.0));
}

int main() {
    printf("==================================================\n");
    printf("   KEYBOARD WARRIOR - C CORE ENGINE & WEB BRIDGE  \n");
    printf("==================================================\n");

    StickmanFighter* player = (StickmanFighter*)malloc(sizeof(StickmanFighter));
    StickmanFighter* enemy  = (StickmanFighter*)malloc(sizeof(StickmanFighter));

    strcpy(player->name, "Glenicko (Warrior)");
    player->hp = 100;
    player->sp = 0;
    player->x_pos = 250;
    player->combo_count = 5;

    strcpy(enemy->name, "Computer AI");
    enemy->hp = 100;
    enemy->sp = 0;
    enemy->x_pos = 320;
    enemy->combo_count = 0;

    export_c_web_bridge(player, enemy, 16, 1.5);

    AttackCommand heavy_slash = {"ENERGETIC KATANA SLASH", 30, 25};
    calculate_c_hitbox(player, enemy, &heavy_slash);

    int simulated_wpm = compute_c_wpm(175, 30.0);
    printf("[C-TELEMETRY] Processed Typing Speed: %d WPM\n", simulated_wpm);
    write_battle_log(player->name, simulated_wpm, player->combo_count);

    free(player);
    free(enemy);

    printf("==================================================\n");
    printf("   C-ENGINE READY: WEB FRONTEND UNLOCKED          \n");
    printf("==================================================\n");
    return 0;
}