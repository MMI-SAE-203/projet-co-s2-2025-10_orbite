import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');


export async function diagnosePocketBase() {
  console.log('🔍 === DIAGNOSTIC POCKETBASE ===');
  
  try {
    
    console.log('1. Test de connexion...');
    const health = await pb.health.check();
    console.log('✅ PocketBase accessible:', health);
    
    
    console.log('2. Collections disponibles...');
    const collections = await pb.collections.getFullList();
    console.log('📚 Collections:', collections.map(c => c.name));
    
   
    console.log('3. Structure de la collection event...');
    const eventCollection = collections.find(c => c.name === 'event');
    if (eventCollection) {
      console.log('✅ Collection event trouvée:', eventCollection);
    } else {
      console.error('❌ Collection event non trouvée !');
      return;
    }
    
    
    console.log('4. Tous les événements dans la base...');
    const allEvents = await pb.collection('event').getFullList({
      sort: '-created'
    });
    console.log(`📊 Nombre total d'événements: ${allEvents.length}`);
    
   
    const recentEvents = allEvents.slice(0, 5);
    console.log('📋 5 derniers événements:');
    recentEvents.forEach((event, index) => {
      console.log(`${index + 1}. ID: ${event.id} | Nom: ${event.nom_event} | Créé: ${event.created}`);
    });
    
    
    console.log('5. Test de création d\'un événement...');
    if (pb.authStore.isValid) {
      const testEvent = {
        nom_event: 'Test Event ' + Date.now(),
        description_event: 'Événement de test pour diagnostic',
        date_event: new Date().toISOString(),
        categorie_event: 'test',
        lieu_event: 'Test Location',
        nb_users_max: 10,
        nb_points_gagne: 5,
        users: pb.authStore.model?.id,
        user: pb.authStore.model?.id,
        date_pub_event: new Date().toISOString(),
        participe: []
      };
      
      const createdEvent = await pb.collection('event').create(testEvent);
      console.log('✅ Événement de test créé:', createdEvent);
      
     
      const retrievedEvent = await pb.collection('event').getOne(createdEvent.id);
      console.log('✅ Événement de test récupéré:', retrievedEvent);
      
      
      await pb.collection('event').delete(createdEvent.id);
      console.log('🗑️ Événement de test supprimé');
    } else {
      console.log('⚠️ Utilisateur non connecté, impossible de tester la création');
    }
    
    console.log('✅ === DIAGNOSTIC TERMINÉ ===');
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}


export async function checkSpecificEvent(eventId: string) {
  console.log(`🔍 Vérification de l'événement ${eventId}...`);
  
  try {
    
    const event = await pb.collection('event').getOne(eventId);
    console.log('✅ Événement trouvé:', event);
    return event;
  } catch (error) {
    console.error('❌ Événement non trouvé:', error);
    
    
    console.log('🔍 Recherche d\'événements similaires...');
    const allEvents = await pb.collection('event').getFullList();
    const similarEvents = allEvents.filter(e => 
      e.id.includes(eventId.substring(0, 5)) || 
      eventId.includes(e.id.substring(0, 5))
    );
    
    if (similarEvents.length > 0) {
      console.log('🔍 Événements similaires trouvés:', similarEvents);
    } else {
      console.log('❌ Aucun événement similaire trouvé');
    }
    
    return null;
  }
}