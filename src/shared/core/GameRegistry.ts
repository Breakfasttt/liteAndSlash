import { Classe, Salle, Ennemi, Arme } from "./BaseClasses";

export class GameRegistry {
  private static classes = new Map<string, new () => Classe>();
  private static salles = new Map<string, new () => Salle>();
  private static ennemis = new Map<string, new () => Ennemi>();
  private static armes = new Map<string, new () => Arme>();

  // Enregistrements
  public static registerClasse(id: string, classRef: new () => Classe) {
    this.classes.set(id, classRef);
  }

  public static registerSalle(id: string, classRef: new () => Salle) {
    this.salles.set(id, classRef);
  }

  public static registerEnnemi(id: string, classRef: new () => Ennemi) {
    this.ennemis.set(id, classRef);
  }

  public static registerArme(id: string, classRef: new () => Arme) {
    this.armes.set(id, classRef);
  }

  // Instanciateurs
  public static createClasse(id: string): Classe {
    const Ref = this.classes.get(id);
    if (!Ref) throw new Error(`Classe non trouvée: ${id}`);
    const instance = new Ref();
    instance.onInit();
    return instance;
  }

  public static createSalle(id: string): Salle {
    const Ref = this.salles.get(id);
    if (!Ref) throw new Error(`Salle non trouvée: ${id}`);
    const instance = new Ref();
    instance.onInit();
    return instance;
  }

  public static createEnnemi(id: string): Ennemi {
    const Ref = this.ennemis.get(id);
    if (!Ref) throw new Error(`Ennemi non trouvé: ${id}`);
    const instance = new Ref();
    instance.onInit();
    return instance;
  }

  public static createArme(id: string): Arme {
    const Ref = this.armes.get(id);
    if (!Ref) throw new Error(`Arme non trouvée: ${id}`);
    const instance = new Ref();
    instance.onInit();
    return instance;
  }

  public static getAllClassIds(): string[] {
    return Array.from(this.classes.keys());
  }

  public static getAllWeaponIds(): string[] {
    return Array.from(this.armes.keys());
  }
}
