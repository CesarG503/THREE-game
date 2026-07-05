import "dotenv/config";
import { analyticsPrisma } from "../server/db/analyticsPrisma.js";
import { logger } from "../server/utils/Logger.js";

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error("Error: Se requiere especificar un userId. Ejemplo: npx tsx scripts/gdpr-delete-user.ts <userId>");
    process.exit(1);
  }

  console.log(`=== INICIANDO PROCESO DE BORRADO REGLAMENTARIO (GDPR/ARCO) PARA EL USUARIO: ${userId} ===`);

  try {
    // Verificar si el usuario existe en la base analítica
    const userExists = await analyticsPrisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      console.warn(`Advertencia: El usuario con ID "${userId}" no se encontró en la réplica de usuarios de Analytics.`);
    }

    // Ejecutar transacciones de borrado / anonimización
    const result = await analyticsPrisma.$transaction(async (tx) => {
      // 1. Anonimizar eventos en RawEvent (nullificando userId para no alterar estadísticas de conversión agregadas)
      const rawEventsAnonymized = await tx.rawEvent.updateMany({
        where: { userId },
        data: { userId: null }
      });

      // 2. Eliminar perfil de características del jugador (PlayerFeatures)
      const playerFeaturesDeleted = await tx.playerFeatures.deleteMany({
        where: { userId }
      });

      // 3. Eliminar fatigas de mapas registradas
      const fatiguedMapsDeleted = await tx.fatiguedMap.deleteMany({
        where: { userId }
      });

      // 4. Eliminar afinidades sociales (donde sea userId1 o userId2)
      const socialAffinityDeleted = await tx.socialAffinity.deleteMany({
        where: {
          OR: [
            { userId1: userId },
            { userId2: userId }
          ]
        }
      });

      // 5. Eliminar el registro del usuario de la réplica analítica
      let userDeleted = 0;
      if (userExists) {
        await tx.user.delete({
          where: { id: userId }
        });
        userDeleted = 1;
      }

      return {
        rawEventsAnonymized: rawEventsAnonymized.count,
        playerFeaturesDeleted: playerFeaturesDeleted.count,
        fatiguedMapsDeleted: fatiguedMapsDeleted.count,
        socialAffinityDeleted: socialAffinityDeleted.count,
        userDeleted
      };
    });

    console.log("\nProceso de borrado completado con éxito:");
    console.log(`- Eventos analíticos (RawEvent) anonimizados: ${result.rawEventsAnonymized}`);
    console.log(`- Perfiles de características (PlayerFeatures) eliminados: ${result.playerFeaturesDeleted}`);
    console.log(`- Registros de fatiga de mapas (FatiguedMap) eliminados: ${result.fatiguedMapsDeleted}`);
    console.log(`- Relaciones de afinidad social (SocialAffinity) eliminadas: ${result.socialAffinityDeleted}`);
    console.log(`- Registro de réplica de usuario (User) eliminado: ${result.userDeleted}`);
    
    logger.info("GDPR", `Right to be forgotten applied successfully for user ${userId}.`);
    process.exit(0);
  } catch (err: any) {
    console.error("Error al procesar el derecho al olvido GDPR:", err);
    logger.error("GDPR", `Failed to delete user data for ${userId}`, err);
    process.exit(1);
  }
}

main();
