import PocketBase from "pocketbase"

export const prerender = false

export async function POST({ request }) {
  try {
    const data = await request.json()
    const { eventId, userId, action } = data

    console.log("🔍 POST /api/participation - Données reçues:", { eventId, userId, action })

    if (!eventId || !userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "eventId et userId sont requis",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    const pb = new PocketBase("http://127.0.0.1:8090")

    // Vérifier que l'événement existe
    try {
      const allEvents = await pb.collection("event").getFullList()
      const targetEvent = allEvents.find((e) => e.id === eventId)
      if (!targetEvent) {
        console.log("❌ Événement non trouvé")
        return new Response(
          JSON.stringify({
            success: false,
            message: `Événement non trouvé. ID recherché: ${eventId}`,
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
      console.log("✅ Événement trouvé:", targetEvent.nom_event)

      // ✅ Vérifier si l'événement est passé
      const eventDate = new Date(targetEvent.date_event)
      const now = new Date()
      if (eventDate < now) {
        console.log("❌ Événement déjà passé")
        return new Response(
          JSON.stringify({
            success: false,
            message: "Impossible de modifier la participation à un événement passé",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
    } catch (listError) {
      console.error("❌ Erreur lors de la vérification de l'événement:", listError)
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erreur lors de l'accès aux événements",
          error: listError.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    // Vérifier si l'utilisateur existe
    let user
    try {
      user = await pb.collection("users").getOne(userId)
      console.log("✅ Utilisateur trouvé:", user.email || user.username || user.name || "ID: " + user.id)
    } catch (userError) {
      console.error("❌ Erreur lors de la récupération de l'utilisateur:", userError)
      return new Response(
        JSON.stringify({
          success: false,
          message: "Utilisateur non trouvé",
          error: userError.message,
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    // Récupérer l'événement pour modification
    const event = await pb.collection("event").getOne(eventId)
    const currentParticipants = event.participe || []

    if (action === "add") {
      if (!currentParticipants.includes(userId)) {
        try {
          console.log("🔄 Ajout de l'utilisateur à la liste des participants...")

          // ✅ SEULEMENT ajouter à la liste - AUCUN POINT DISTRIBUÉ
          const updatedParticipants = [...currentParticipants, userId]

          await pb.collection("event").update(eventId, {
            participe: updatedParticipants,
          })

          console.log("✅ Participation ajoutée avec succès - AUCUN point distribué")

          return new Response(
            JSON.stringify({
              success: true,
              message: "Participation ajoutée avec succès. Points distribués après l'événement.",
            }),
            {
              status: 201,
              headers: {
                "Content-Type": "application/json",
              },
            },
          )
        } catch (error) {
          console.error("❌ Erreur lors de l'ajout de la participation:", error)

          return new Response(
            JSON.stringify({
              success: false,
              message: "Erreur lors de l'ajout de la participation",
              error: error.message,
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            },
          )
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: "L'utilisateur participe déjà à cet événement",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
    } else if (action === "remove") {
      if (currentParticipants.includes(userId)) {
        try {
          console.log("🔄 Retrait de l'utilisateur de la liste des participants...")

          const updatedParticipants = currentParticipants.filter((id) => id !== userId)

          await pb.collection("event").update(eventId, {
            participe: updatedParticipants,
          })

          console.log("✅ Participation supprimée avec succès")

          return new Response(
            JSON.stringify({
              success: true,
              message: "Participation supprimée avec succès",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          )
        } catch (error) {
          console.error("❌ Erreur lors de la suppression de la participation:", error)

          return new Response(
            JSON.stringify({
              success: false,
              message: "Erreur lors de la suppression de la participation",
              error: error.message,
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            },
          )
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: "L'utilisateur ne participe pas à cet événement",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Action non reconnue",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }
  } catch (error) {
    console.error("❌ Erreur générale lors de la gestion de la participation:", error)

    return new Response(
      JSON.stringify({
        success: false,
        message: "Erreur serveur",
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

export async function GET({ request, url }) {
  try {
    const eventId = url.searchParams.get("eventId")

    if (!eventId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "eventId est requis",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    const pb = new PocketBase("http://127.0.0.1:8090")

    // Vérifier que l'événement existe
    try {
      const allEvents = await pb.collection("event").getFullList()
      const targetEvent = allEvents.find((e) => e.id === eventId)
      if (!targetEvent) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Événement non trouvé. ID recherché: ${eventId}`,
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
    } catch (listError) {
      console.error("❌ Erreur lors de la vérification de l'événement:", listError)
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erreur lors de l'accès aux événements",
          error: listError.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    // Récupérer les participations pour cet événement
    try {
      const participations = await pb.collection("participer").getFullList({
        filter: `event = "${eventId}"`,
        expand: "user",
      })

      return new Response(
        JSON.stringify({
          success: true,
          count: participations.length,
          items: participations,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    } catch (participationError) {
      console.log("ℹ️ Collection participer non trouvée ou vide:", participationError.message)
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          items: [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }
  } catch (error) {
    console.error("❌ Erreur générale lors de la récupération des participations:", error)

    return new Response(
      JSON.stringify({
        success: false,
        message: "Erreur serveur",
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
