import PocketBase from "pocketbase"


const pb = new PocketBase("http://127.0.0.1:8090") 
export interface Event {
  id: string
  nom_event: string
  description_event: string
  date_event: string
  categorie_event: string
  lieu_event: string
  nb_users_max: number
  nb_points_gagne: number
  image_event: string
  location: string | { lat: number; lng: number }
  user: string // ID de l'utilisateur créateur (ancien champ)
  users: string // ID de l'utilisateur créateur (nouvelle relation)
  participe: string[] // IDs des utilisateurs qui participent
  date_pub_event: string // Date de publication
  created: string
  updated: string
}

export interface User {
  id: string
  name: string
  username: string
  email: string
  avatar: string
  points: number // ✅ Ajout du champ points
  created: string
  updated: string
}

// ✅ Interface pour les commentaires
export interface Comment {
  id: string
  event: string // ID de l'événement
  users: string // ID de l'utilisateur qui commente
  content: string // Contenu du commentaire
  created: string
  updated: string
  expand?: {
    users?: User // Données de l'utilisateur expandées
  }
}

// ✅ Récupérer tous les événements avec debugging amélioré
export async function getAllEvents(): Promise<Event[]> {
  try {
    console.log("🔍 Tentative de connexion à PocketBase...")
    console.log("URL PocketBase:", pb.baseUrl)

    
    const health = await pb.health.check()
    console.log("✅ PocketBase est accessible:", health)

    
    console.log("📋 Récupération des événements...")
    const records = await pb.collection("event").getFullList({
      sort: "-date_event",
      expand: "users", // ✅ Seulement expand users, pas participe
      requestKey: null, // Évite la mise en cache
    })

    console.log("📊 Nombre d'événements trouvés:", records.length)
    console.log("📄 Données des événements:", records)

    return records as Event[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des événements:", error)

    
    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message)
      console.error("Stack trace:", error.stack)
    }

   
    try {
      const collections = await pb.collections.getFullList()
      console.log(
        "📚 Collections disponibles:",
        collections.map((c) => c.name),
      )
    } catch (collectionError) {
      console.error("❌ Impossible de récupérer les collections:", collectionError)
    }

    return []
  }
}

s

export async function getEventById(id: string): Promise<Event | null> {
  try {
    console.log("🔍 Récupération de l'événement ID:", id)

    if (!id || id.trim() === "") {
      console.error("❌ ID d'événement invalide:", id)
      return null
    }

   
    try {
      const collections = await pb.collections.getFullList()
      const eventCollection = collections.find((c) => c.name === "event")
      if (!eventCollection) {
        console.error("❌ Collection 'event' introuvable dans la base de données")
        return null
      }
      console.log("✅ Collection 'event' trouvée")
    } catch (collectionError) {
      console.error("❌ Erreur lors de la vérification des collections:", collectionError)
    }

   
    const validIdRegex = /^[a-zA-Z0-9]{15}$/
    if (!validIdRegex.test(id)) {
      console.error("❌ Format d'ID invalide. Les IDs PocketBase font généralement 15 caractères alphanumériques.")
      console.log("🔍 ID reçu:", id, "Longueur:", id.length)
      return null
    }

  
    console.log("🔄 Tentative de récupération de l'événement sans expand...")
    const record = await pb.collection("event").getOne(id)

    console.log("✅ Événement trouvé:", record)

   
    try {
      const recordWithExpand = await pb.collection("event").getOne(id, {
        expand: "users",
        requestKey: null, // Évite la mise en cache
      })
      console.log("✅ Événement avec expand users récupéré")
      return recordWithExpand as Event
    } catch (expandError) {
      console.warn("⚠️ Impossible d'expand users, utilisation de l'événement simple:", expandError)
      return record as Event
    }
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'événement:", error)

    
    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message)

      
      if (error.message.includes("404") || error.message.includes("not found")) {
        console.log("📝 L'événement n'existe pas dans la base de données")

       
        try {
          console.log("🔍 Vérification des événements disponibles...")
          const allEvents = await pb.collection("event").getFullList({
            fields: "id,nom_event",
            requestKey: null,
          })
          console.log(
            "📋 Événements disponibles:",
            allEvents.map((e) => ({ id: e.id, nom: e.nom_event })),
          )

          
          const similarEvents = allEvents.filter(
            (e) => e.id.includes(id.substring(0, 5)) || id.includes(e.id.substring(0, 5)),
          )
          if (similarEvents.length > 0) {
            console.log("💡 Événements avec ID similaire:", similarEvents)
          }
        } catch (listError) {
          console.error("❌ Impossible de lister les événements:", listError)
        }
      }
    }

    return null
  }
}

// ✅ NOUVELLES FONCTIONS POUR LES COMMENTAIRES


export async function getEventComments(eventId: string): Promise<Comment[]> {
  try {
    console.log("💬 Récupération des commentaires pour l'événement:", eventId)

    const comments = await pb.collection("comments").getFullList({
      filter: `event = "${eventId}"`,
      sort: "-created", // Plus récents en premier
      expand: "users", // Récupérer les données de l'utilisateur
      requestKey: null,
    })

    console.log("✅ Commentaires trouvés:", comments.length)
    return comments as Comment[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des commentaires:", error)
    return []
  }
}


export async function createComment(eventId: string, userId: string, content: string): Promise<Comment> {
  try {
    console.log("💬 Création d'un nouveau commentaire...")

    if (!pb.authStore.isValid) {
      throw new Error("Utilisateur non authentifié")
    }

    if (!content || content.trim() === "") {
      throw new Error("Le commentaire ne peut pas être vide")
    }

    const commentData = {
      event: eventId,
      users: userId,
      content: content.trim(),
    }

    const record = await pb.collection("comments").create(commentData, {
      expand: "users",
      requestKey: null,
    })

    console.log("✅ Commentaire créé avec succès:", record)
    return record as Comment
  } catch (error) {
    console.error("❌ Erreur lors de la création du commentaire:", error)
    throw error
  }
}


export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    console.log("🗑️ Suppression du commentaire:", commentId)

    if (!pb.authStore.isValid) {
      throw new Error("Utilisateur non authentifié")
    }

    
    const comment = await pb.collection("comments").getOne(commentId)
    if (comment.users !== pb.authStore.model?.id) {
      throw new Error("Vous ne pouvez supprimer que vos propres commentaires")
    }

    await pb.collection("comments").delete(commentId)

    console.log("✅ Commentaire supprimé avec succès")
    return true
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du commentaire:", error)
    throw error
  }
}


export async function getCommentsCount(eventId: string): Promise<number> {
  try {
    const comments = await pb.collection("comments").getFullList({
      filter: `event = "${eventId}"`,
      fields: "id",
      requestKey: null,
    })
    return comments.length
  } catch (error) {
    console.error("❌ Erreur lors du comptage des commentaires:", error)
    return 0
  }
}

// ✅ Nouvelle fonction pour créer un événement avec validation et points automatiques
export async function createEvent(eventData: FormData): Promise<Event> {
  try {
    console.log("🔄 Création d'un nouvel événement...")

    
    if (!pb.authStore.isValid) {
      throw new Error("Utilisateur non authentifié")
    }

   
    const requiredFields = ["nom_event", "description_event", "date_event", "categorie_event", "lieu_event"]
    for (const field of requiredFields) {
      if (!eventData.get(field)) {
        throw new Error(`Le champ ${field} est requis`)
      }
    }

    
    eventData.append("users", pb.authStore.model?.id || "")
    eventData.append("user", pb.authStore.model?.id || "")
    eventData.append("date_pub_event", new Date().toISOString())

    // ✅ Points automatiques : toujours 10 points
    eventData.append("nb_points_gagne", "10")

    
    eventData.append("participe", JSON.stringify([]))

    
    const record = await pb.collection("event").create(eventData, {
      requestKey: null, // Évite la mise en cache
    })

    console.log("✅ Événement créé avec succès:", record)
    console.log("ℹ️ AUCUN point distribué - les points seront attribués après la date de l'événement")

  
    await invalidateEventsCache()

    return record as Event
  } catch (error) {
    console.error("❌ Erreur lors de la création de l'événement:", error)
    throw error
  }
}

// ✅ Fonction intelligente pour vérifier et attribuer les points aux participants après la date de l'événement
export async function checkAndAwardParticipationPoints(): Promise<{
  success: boolean
  eventsProcessed: number
  participantsRewarded: number
  totalPointsAwarded: number
  events: Array<{ id: string; name: string; participants: number }>
}> {
  try {
    console.log("🎯 Vérification intelligente des événements qui viennent de passer...")

    const now = new Date()

   
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    const recentlyPassedEvents = await pb.collection("event").getFullList({
      filter: `date_event >= "${fiveMinutesAgo.toISOString()}" && date_event <= "${now.toISOString()}" && points_distributed != true`,
    })

    console.log(`📋 ${recentlyPassedEvents.length} événements viennent de passer`)

    let totalPointsAwarded = 0
    let participantsRewarded = 0
    const eventsProcessed: Array<{ id: string; name: string; participants: number }> = []

    for (const event of recentlyPassedEvents) {
      if (event.participe && event.participe.length > 0) {
        console.log(`⭐ Attribution immédiate des points pour l'événement: ${event.nom_event}`)

       
        for (const participantId of event.participe) {
          try {
            const participant = await pb.collection("users").getOne(participantId)
            const currentPoints = participant.points || 0
            const newPoints = currentPoints + 10

            await pb.collection("users").update(participantId, {
              points: newPoints,
            })

            totalPointsAwarded += 10
            participantsRewarded++

            console.log(
              `✅ Points attribués immédiatement à ${participant.username || participant.email}: ${currentPoints} -> ${newPoints}`,
            )
          } catch (userError) {
            console.warn(`⚠️ Impossible d'attribuer les points à l'utilisateur ${participantId}:`, userError)
          }
        }

        
        await pb.collection("event").update(event.id, {
          points_distributed: true,
        })

        eventsProcessed.push({
          id: event.id,
          name: event.nom_event,
          participants: event.participe.length,
        })

        console.log(`✅ Événement ${event.nom_event} marqué comme points distribués`)
      }
    }

    console.log("✅ Vérification intelligente terminée")

    return {
      success: true,
      eventsProcessed: eventsProcessed.length,
      participantsRewarded,
      totalPointsAwarded,
      events: eventsProcessed,
    }
  } catch (error) {
    console.error("❌ Erreur lors de la vérification intelligente des points:", error)
    return {
      success: false,
      eventsProcessed: 0,
      participantsRewarded: 0,
      totalPointsAwarded: 0,
      events: [],
    }
  }
}

// ✅ Fonction pour invalider le cache des événements
async function invalidateEventsCache(): Promise<void> {
  try {
   
    await pb.collection("event").getFullList({
      sort: "-date_event",
      expand: "users", // ✅ Correction ici aussi
      requestKey: null,
    })
    console.log("🔄 Cache des événements invalidé")
  } catch (error) {
    console.warn("⚠️ Impossible d'invalider le cache:", error)
  }
}


export async function getEventsByCategory(category: string): Promise<Event[]> {
  try {
    console.log("🔍 Récupération des événements pour la catégorie:", category)
    const records = await pb.collection("event").getFullList({
      filter: `categorie_event = "${category}"`,
      sort: "-date_event",
      expand: "users",
      requestKey: null,
    })
    console.log("✅ Événements trouvés:", records.length)
    return records as Event[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des événements par catégorie:", error)
    return []
  }
}


export async function getEventsByLocation(location: string): Promise<Event[]> {
  try {
    console.log("🔍 Récupération des événements pour le lieu:", location)
    const records = await pb.collection("event").getFullList({
      filter: `lieu_event = "${location}"`,
      sort: "-date_event",
      expand: "users",
      requestKey: null,
    })
    console.log("✅ Événements trouvés:", records.length)
    return records as Event[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des événements par lieu:", error)
    return []
  }
}


export function getImageUrl(record: Event, filename: string): string {
  if (!filename) return ""
  return pb.files.getUrl(record, filename)
}


export function formatDate(dateString: string): string {
  if (!dateString) return "Date non définie"

  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return "Date non définie"
  }
}


export function formatTime(dateString: string): string {
  if (!dateString) return "Heure non définie"

  try {
    const date = new Date(dateString)
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "Heure non définie"
  }
}


export async function testConnection(): Promise<boolean> {
  try {
    await pb.health.check()
    return true
  } catch {
    return false
  }
}


export async function getCategories(): Promise<string[]> {
  try {
    const events = await getAllEvents()
    const categories = [...new Set(events.map((event) => event.categorie_event))]
    return categories.filter((cat) => cat && cat.trim() !== "")
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des catégories:", error)
    return []
  }
}


export async function getLocations(): Promise<string[]> {
  try {
    const events = await getAllEvents()
    const locations = [...new Set(events.map((event) => event.lieu_event))]
    return locations.filter((loc) => loc && loc.trim() !== "")
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des lieux:", error)
    return []
  }
}


export async function searchEvents(query: string): Promise<Event[]> {
  try {
    console.log("🔍 Recherche d'événements avec:", query)
    const records = await pb.collection("event").getFullList({
      filter: `nom_event ~ "${query}" || description_event ~ "${query}" || lieu_event ~ "${query}"`,
      sort: "-date_event",
      expand: "users",
      requestKey: null,
    })
    console.log("✅ Événements trouvés:", records.length)
    return records as Event[]
  } catch (error) {
    console.error("❌ Erreur lors de la recherche d'événements:", error)
    return []
  }
}


export function isAuthenticated(): boolean {
  return pb.authStore.isValid
}


export function getCurrentUser() {
  return pb.authStore.model
}


export async function getCurrentUserProfile(): Promise<User | null> {
  try {
    if (!pb.authStore.isValid) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = pb.authStore.model
    console.log("✅ Profil utilisateur récupéré:", user)
    return user as User
  } catch (error) {
    console.error("❌ Erreur lors de la récupération du profil:", error)
    return null
  }
}


export function getUserAvatarUrl(user: any, filename: string): string {
  if (!filename || !user) return ""
  return pb.files.getUrl(user, filename)
}


export async function getUserEvents(userId: string): Promise<Event[]> {
  try {
    console.log("🔍 Récupération des événements pour l'utilisateur:", userId)

    
    const events = await pb.collection("event").getFullList({
      filter: `users = "${userId}"`,
      sort: "-date_event",
      expand: "users",
      requestKey: null,
    })

    console.log("✅ Événements créés trouvés:", events.length)
    return events as Event[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des événements utilisateur:", error)
    return []
  }
}


export async function updateUserProfile(userId: string, formData: FormData): Promise<User> {
  try {
    console.log("🔄 Mise à jour du profil utilisateur...")

    if (!pb.authStore.isValid) {
      throw new Error("Utilisateur non authentifié")
    }

    const record = await pb.collection("users").update(userId, formData)

  
    pb.authStore.save(pb.authStore.token, record)

    console.log("✅ Profil mis à jour avec succès:", record)
    return record as User
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du profil:", error)
    throw error
  }
}


export async function deleteEvent(eventId: string): Promise<boolean> {
  try {
    console.log("🗑️ Suppression de l'événement:", eventId)

    if (!pb.authStore.isValid) {
      throw new Error("Utilisateur non authentifié")
    }

    await pb.collection("event").delete(eventId)

    console.log("✅ Événement supprimé avec succès")
    return true
  } catch (error) {
    console.error("❌ Erreur lors de la suppression de l'événement:", error)
    throw error
  }
}

// ✅ Fonction pour faire participer un utilisateur à un événement (corrigée)
export async function joinEvent(eventId: string, userId: string): Promise<boolean> {
  try {
    console.log("🎯 Inscription à l'événement:", eventId, "pour l'utilisateur:", userId)

   
    const event = await pb.collection("event").getOne(eventId)

   
    const currentParticipants = event.participe || []
    if (currentParticipants.length >= (event.nb_users_max || 0)) {
      throw new Error("Événement complet")
    }

   
    if (currentParticipants.includes(userId)) {
      throw new Error("Utilisateur déjà inscrit")
    }

    // ✅ SEULEMENT ajouter l'utilisateur à la liste des participants - AUCUN POINT
    const updatedParticipants = [...currentParticipants, userId]

  
    await pb.collection("event").update(eventId, {
      participe: updatedParticipants,
    })

    console.log("✅ Inscription réussie - AUCUN point distribué immédiatement")
    return true
  } catch (error) {
    console.error("❌ Erreur lors de l'inscription:", error)
    throw error
  }
}

// ✅ Fonction pour faire quitter un utilisateur d'un événement (corrigée)
export async function leaveEvent(eventId: string, userId: string): Promise<boolean> {
  try {
    console.log("🚪 Sortie de l'événement:", eventId, "pour l'utilisateur:", userId)

    
    const event = await pb.collection("event").getOne(eventId)

   
    const currentParticipants = event.participe || []
    const updatedParticipants = currentParticipants.filter((id) => id !== userId)

  
    await pb.collection("event").update(eventId, {
      participe: updatedParticipants,
    })

    console.log("✅ Sortie réussie")
    return true
  } catch (error) {
    console.error("❌ Erreur lors de la sortie:", error)
    throw error
  }
}

// ✅ Fonction pour obtenir les participants d'un événement avec leurs détails (corrigée)
export async function getEventParticipants(eventId: string): Promise<User[]> {
  try {
    console.log("👥 Récupération des participants pour l'événement:", eventId)

    const event = await pb.collection("event").getOne(eventId)
    const participantIds = event.participe || []

    if (participantIds.length === 0) {
      console.log("ℹ️ Aucun participant pour cet événement")
      return []
    }

    
    const participants = []
    for (const userId of participantIds) {
      try {
        const user = await pb.collection("users").getOne(userId)
        participants.push(user)
      } catch (userError) {
        console.warn("⚠️ Impossible de récupérer l'utilisateur:", userId, userError)
      }
    }

    console.log("✅ Participants trouvés:", participants.length)
    return participants as User[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des participants:", error)
    return []
  }
}


export async function getUserParticipations(userId: string): Promise<Event[]> {
  try {
    console.log("🎭 Récupération des participations pour l'utilisateur:", userId)

   
    const events = await pb.collection("event").getFullList({
      filter: `participe ~ "${userId}"`,
      sort: "-date_event",
      expand: "users",
      requestKey: null,
    })

    console.log("✅ Participations trouvées:", events.length)
    return events as Event[]
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des participations:", error)
    return []
  }
}


export async function isUserParticipating(eventId: string, userId: string): Promise<boolean> {
  try {
    const event = await pb.collection("event").getOne(eventId)
    const participants = event.participe || []
    return participants.includes(userId)
  } catch (error) {
    console.error("❌ Erreur lors de la vérification de participation:", error)
    return false
  }
}


export async function getParticipantCount(eventId: string): Promise<number> {
  try {
    const event = await pb.collection("event").getOne(eventId)
    return event.participe ? event.participe.length : 0
  } catch (error) {
    console.error("❌ Erreur lors du comptage des participants:", error)
    return 0
  }
}


export async function isEventFull(eventId: string): Promise<boolean> {
  try {
    const event = await pb.collection("event").getOne(eventId)
    const currentParticipants = event.participe ? event.participe.length : 0
    const maxParticipants = event.nb_users_max || 0
    return currentParticipants >= maxParticipants
  } catch (error) {
    console.error("❌ Erreur lors de la vérification de capacité:", error)
    return false
  }
}


export async function getUserTotalPoints(userId: string): Promise<number> {
  try {
    console.log("🔍 Récupération des points totaux pour l'utilisateur:", userId)

    const user = await pb.collection("users").getOne(userId)

    
    const totalPoints = user.points || 0
    console.log("⭐ Points totaux:", totalPoints)

    return totalPoints
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des points:", error)
    return 0
  }
}

export default pb
