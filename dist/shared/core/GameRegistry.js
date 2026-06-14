export class GameRegistry {
    static classes = new Map();
    static salles = new Map();
    static ennemis = new Map();
    static armes = new Map();
    // Enregistrements
    static registerClasse(id, classRef) {
        this.classes.set(id, classRef);
    }
    static registerSalle(id, classRef) {
        this.salles.set(id, classRef);
    }
    static registerEnnemi(id, classRef) {
        this.ennemis.set(id, classRef);
    }
    static registerArme(id, classRef) {
        this.armes.set(id, classRef);
    }
    // Instanciateurs
    static createClasse(id) {
        const Ref = this.classes.get(id);
        if (!Ref)
            throw new Error(`Classe non trouvée: ${id}`);
        const instance = new Ref();
        instance.onInit();
        return instance;
    }
    static createSalle(id) {
        const Ref = this.salles.get(id);
        if (!Ref)
            throw new Error(`Salle non trouvée: ${id}`);
        const instance = new Ref();
        instance.onInit();
        return instance;
    }
    static createEnnemi(id) {
        const Ref = this.ennemis.get(id);
        if (!Ref)
            throw new Error(`Ennemi non trouvé: ${id}`);
        const instance = new Ref();
        instance.onInit();
        return instance;
    }
    static createArme(id) {
        const Ref = this.armes.get(id);
        if (!Ref)
            throw new Error(`Arme non trouvée: ${id}`);
        const instance = new Ref();
        instance.onInit();
        return instance;
    }
    static getAllClassIds() {
        return Array.from(this.classes.keys());
    }
    static getAllWeaponIds() {
        return Array.from(this.armes.keys());
    }
}
