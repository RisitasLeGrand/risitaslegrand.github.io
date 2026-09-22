/// <reference types="@angular/localize" />

import { loadTranslations } from '@angular/localize';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

// TRADUCTION FR (ajout par rapport au dépôt d'origine).
//
// Les gabarits de ng-bootstrap portent leurs propres messages « i18n », que
// l'on ne peut pas traduire en modifiant nos fichiers : ils vivent dans la
// bibliothèque. Ils sont en revanche identifiés, donc remplaçables au
// démarrage. Ces libellés sont destinés aux lecteurs d'écran (classe
// « visually-hidden ») ou aux composants de pagination et de saisie d'heure.
// Le libellé de la barre de progression n'est qu'un nombre : rien à traduire.
loadTranslations({
    'ngb.carousel.previous': 'Précédent',
    'ngb.carousel.next': 'Suivant',
    'ngb.pagination.first': 'Première page',
    'ngb.pagination.last': 'Dernière page',
    'ngb.pagination.previous': 'Page précédente',
    'ngb.pagination.next': 'Page suivante',
    'ngb.timepicker.AM': 'AM',
    'ngb.timepicker.PM': 'PM',
    'ngb.timepicker.increment': 'Augmenter',
    'ngb.timepicker.decrement': 'Diminuer',
});


platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
